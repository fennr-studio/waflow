import type { Config } from "./config.js";
import { FlowEngine } from "./flow/engine.js";
import type { Conversation, Flow, Lead } from "./flow/types.js";
import type { Store } from "./store/types.js";
import { verifySignature } from "./webhook/verify.js";
import { parseInbound } from "./webhook/parse.js";
import { WhatsAppClient } from "./whatsapp/client.js";
import type { InboundMessage } from "./whatsapp/types.js";

export type LeadHandler = (lead: Lead) => void | Promise<void>;

/**
 * The reusable engine surface. Wire it to any web framework: verify the
 * signature, then hand the parsed JSON payload to `handleWebhook`. It runs
 * the flow, persists state, sends replies, and fires `onLead` when a
 * conversation completes.
 */
export class Bot {
  private readonly engine: FlowEngine;
  private readonly client: WhatsAppClient;
  private readonly leadHandlers: LeadHandler[] = [];

  constructor(
    private readonly cfg: Config,
    private readonly store: Store,
    flow: Flow,
  ) {
    this.engine = new FlowEngine(flow);
    this.client = new WhatsAppClient(cfg);
  }

  /** Register a callback fired whenever a lead completes the flow. */
  onLead(handler: LeadHandler): void {
    this.leadHandlers.push(handler);
  }

  /** Verify a webhook POST against its X-Hub-Signature-256 header. */
  verify(rawBody: string, signature: string | undefined | null): boolean {
    return verifySignature(rawBody, signature, this.cfg.WHATSAPP_APP_SECRET);
  }

  /** Process a full webhook payload (may contain several messages). */
  async handleWebhook(payload: unknown): Promise<void> {
    const inbound = parseInbound(payload);
    // Process sequentially per user to keep conversation state consistent.
    for (const msg of inbound) {
      await this.process(msg).catch((err) => {
        console.error(`[waflow] failed processing message from ${msg.from}:`, err);
      });
    }
  }

  private async process(msg: InboundMessage): Promise<void> {
    void this.client.markRead(msg.messageId);

    const existing = await this.store.getConversation(msg.from);
    const outcome = this.engine.step(existing, {
      replyId: msg.replyId,
      text: msg.text ?? msg.replyTitle,
      name: msg.name,
    });

    // Bind the conversation to this user and persist before sending so a send
    // failure can't lose progress.
    const conv: Conversation = { ...outcome.conversation, from: msg.from };
    if (outcome.completed) {
      await this.store.clearConversation(msg.from);
    } else {
      await this.store.saveConversation(conv);
    }

    await this.client.sendAll(msg.from, outcome.messages);

    if (outcome.completed) {
      const lead: Lead = {
        from: msg.from,
        name: msg.name ?? conv.data.name,
        data: conv.data,
        completedAt: Date.now(),
      };
      await this.store.saveLead(lead).catch((e) => console.error("[waflow] saveLead failed:", e));
      for (const h of this.leadHandlers) await Promise.resolve(h(lead)).catch((e) => console.error("[waflow] onLead failed:", e));
    }
  }
}
