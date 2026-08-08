import type { Config } from "./config.js";
import { FlowEngine } from "./flow/engine.js";
import type { Conversation, Flow, FlowData, Lead } from "./flow/types.js";
import type { Store } from "./store/types.js";
import { verifySignature } from "./webhook/verify.js";
import { parseInbound } from "./webhook/parse.js";
import { WhatsAppClient } from "./whatsapp/client.js";
import type { InboundMessage } from "./whatsapp/types.js";

export type LeadHandler = (lead: Lead) => void | Promise<void>;

/**
 * Configures "form mode": instead of the step-by-step conversation, the bot
 * sends a single native WhatsApp Flow (a multi-select form, like the website
 * brief) and turns the submission into a lead.
 */
export interface FormFlow {
  /** Published Flow id from WhatsApp Manager. */
  flowId: string;
  /** The Flow's terminal screen id (e.g. "BRIEF"). */
  screen: string;
  /** Button label that opens the form. */
  cta: string;
  /** Intro text shown above the button. */
  body: string;
  header?: string;
  footer?: string;
  /** Map the submitted `response_json` into flat lead data. */
  map: (response: Record<string, unknown>) => FlowData;
  /** Optional confirmation message sent after submission. */
  done?: (data: FlowData) => string;
}

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
  private formFlow?: FormFlow;

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

  /**
   * Switch to WhatsApp Flow "form mode": the bot sends a single native form
   * and turns the submission into a lead, instead of the step-by-step chat.
   */
  useForm(form: FormFlow): this {
    this.formFlow = form;
    return this;
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

    if (this.formFlow) return this.processForm(msg, this.formFlow);

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

    // A failed reply must never lose a captured lead — log and continue.
    try {
      await this.client.sendAll(msg.from, outcome.messages);
    } catch (e) {
      console.error(`[waflow] send failed for ${msg.from}:`, e);
    }

    if (outcome.completed) {
      const lead: Lead = {
        from: msg.from,
        name: msg.name ?? conv.data.name,
        data: conv.data,
        completedAt: Date.now(),
      };
      await this.emitLead(lead);
    }
  }

  /** Form mode: send the WhatsApp Flow, or turn a submission into a lead. */
  private async processForm(msg: InboundMessage, form: FormFlow): Promise<void> {
    // A completed submission → build the lead.
    if (msg.flowResponse) {
      const data = form.map(msg.flowResponse);
      await this.store.clearConversation(msg.from);
      try {
        if (form.done) await this.client.send(msg.from, { kind: "text", body: form.done(data), previewUrl: true });
      } catch (e) {
        console.error(`[waflow] send failed for ${msg.from}:`, e);
      }
      await this.emitLead({ from: msg.from, name: msg.name ?? data.name, data, completedAt: Date.now() });
      return;
    }

    // Any other inbound → (re)send the form. Token correlates the submission.
    await this.client.sendFlow(msg.from, {
      flowId: form.flowId,
      flowToken: `wa_${msg.from}_${Date.now()}`,
      cta: form.cta,
      body: form.body,
      header: form.header,
      footer: form.footer,
      screen: form.screen,
    });
  }

  private async emitLead(lead: Lead): Promise<void> {
    for (const h of this.leadHandlers) {
      await Promise.resolve(h(lead)).catch((e) => console.error("[waflow] onLead failed:", e));
    }
  }
}
