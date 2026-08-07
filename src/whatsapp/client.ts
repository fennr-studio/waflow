import type { Config } from "../config.js";
import type { OutgoingMessage } from "./types.js";

/** Parameters for sending a WhatsApp Flow message. */
export interface SendFlowOptions {
  flowId: string;
  /** Correlates the submission back to this user/session. */
  flowToken: string;
  /** Button label that opens the form (max 20 chars). */
  cta: string;
  /** Message text shown above the button. */
  body: string;
  /** The Flow's first (terminal) screen id, e.g. "BRIEF". */
  screen: string;
  header?: string;
  footer?: string;
  /** Optional initial data passed to the screen. */
  data?: Record<string, unknown>;
}

/**
 * Thin, typed client over the WhatsApp Cloud API `/messages` endpoint.
 * Converts our friendly `OutgoingMessage` shapes into Meta's wire format.
 */
export class WhatsAppClient {
  private readonly base: string;
  private readonly token: string;

  constructor(cfg: Pick<Config, "WHATSAPP_API_VERSION" | "WHATSAPP_PHONE_NUMBER_ID" | "WHATSAPP_TOKEN">) {
    this.base = `https://graph.facebook.com/${cfg.WHATSAPP_API_VERSION}/${cfg.WHATSAPP_PHONE_NUMBER_ID}`;
    this.token = cfg.WHATSAPP_TOKEN;
  }

  /** Send one message to a recipient (E.164 without '+'). */
  async send(to: string, msg: OutgoingMessage): Promise<void> {
    await this.post("/messages", { messaging_product: "whatsapp", recipient_type: "individual", to, ...toWire(msg) });
  }

  /** Send several messages in order. */
  async sendAll(to: string, msgs: OutgoingMessage[]): Promise<void> {
    for (const m of msgs) await this.send(to, m);
  }

  /** Send a WhatsApp Flow (native in-chat form) to a recipient. */
  async sendFlow(to: string, opts: SendFlowOptions): Promise<void> {
    await this.post("/messages", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: opts.body },
        ...(opts.header ? { header: { type: "text", text: opts.header } } : {}),
        ...(opts.footer ? { footer: { text: opts.footer } } : {}),
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: opts.flowId,
            flow_token: opts.flowToken,
            flow_cta: opts.cta,
            flow_action: "navigate",
            flow_action_payload: { screen: opts.screen, ...(opts.data ? { data: opts.data } : {}) },
          },
        },
      },
    });
  }

  /** Mark an inbound message as read (the blue ticks). Best-effort. */
  async markRead(messageId: string): Promise<void> {
    try {
      await this.post("/messages", { messaging_product: "whatsapp", status: "read", message_id: messageId });
    } catch {
      /* read receipts are non-critical */
    }
  }

  private async post(path: string, payload: unknown): Promise<unknown> {
    const res = await fetch(this.base + path, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`WhatsApp API ${res.status}: ${text}`);
    }
    return res.json().catch(() => ({}));
  }
}

/** Map an OutgoingMessage to the WhatsApp Cloud API request body fields. */
function toWire(msg: OutgoingMessage): Record<string, unknown> {
  switch (msg.kind) {
    case "text":
      return { type: "text", text: { body: cap(msg.body, 4096), preview_url: msg.previewUrl ?? false } };
    case "list":
      return {
        type: "interactive",
        interactive: {
          type: "list",
          ...(msg.header ? { header: { type: "text", text: cap(msg.header, 60) } } : {}),
          body: { text: cap(msg.body, 4096) },
          ...(msg.footer ? { footer: { text: cap(msg.footer, 60) } } : {}),
          action: {
            button: cap(msg.button, 20),
            sections: msg.sections.map((s) => ({
              ...(s.title ? { title: cap(s.title, 24) } : {}),
              rows: s.rows.map((r) => ({
                id: cap(r.id, 200),
                title: cap(r.title, 24),
                ...(r.description ? { description: cap(r.description, 72) } : {}),
              })),
            })),
          },
        },
      };
    case "buttons":
      return {
        type: "interactive",
        interactive: {
          type: "button",
          ...(msg.header ? { header: { type: "text", text: cap(msg.header, 60) } } : {}),
          body: { text: cap(msg.body, 4096) },
          ...(msg.footer ? { footer: { text: cap(msg.footer, 60) } } : {}),
          action: {
            buttons: msg.buttons.slice(0, 3).map((b) => ({
              type: "reply",
              reply: { id: cap(b.id, 256), title: cap(b.title, 20) },
            })),
          },
        },
      };
  }
}

function cap(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}
