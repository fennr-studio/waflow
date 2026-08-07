import type { InboundMessage } from "../whatsapp/types.js";

/**
 * Extract normalized inbound messages from a WhatsApp webhook payload.
 *
 * A single webhook can carry multiple entries/changes/messages, and also
 * status-only events (delivered/read) we deliberately ignore here. We only
 * surface user-authored messages the flow engine can act on.
 */
export function parseInbound(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const body = payload as WebhookBody;
  if (body?.object !== "whatsapp_business_account") return out;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;
      const nameByWa = new Map<string, string>();
      for (const c of value.contacts ?? []) {
        if (c.wa_id && c.profile?.name) nameByWa.set(c.wa_id, c.profile.name);
      }
      for (const m of value.messages) {
        const base: InboundMessage = {
          from: m.from,
          messageId: m.id,
          name: nameByWa.get(m.from),
          timestamp: Number(m.timestamp) || Math.floor(Date.now() / 1000),
        };
        if (m.type === "text" && m.text) {
          out.push({ ...base, text: m.text.body });
        } else if (m.type === "interactive" && m.interactive) {
          const i = m.interactive;
          if (i.type === "list_reply" && i.list_reply) {
            out.push({ ...base, replyId: i.list_reply.id, replyTitle: i.list_reply.title });
          } else if (i.type === "button_reply" && i.button_reply) {
            out.push({ ...base, replyId: i.button_reply.id, replyTitle: i.button_reply.title });
          }
        } else if (m.type === "button" && m.button) {
          // Template quick-reply buttons arrive as `button`, payload is the id.
          out.push({ ...base, replyId: m.button.payload, replyTitle: m.button.text });
        }
      }
    }
  }
  return out;
}

// ---- Loose shapes for the raw webhook (only fields we read) ----
interface WebhookBody {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<RawMessage>;
      };
    }>;
  }>;
}

interface RawMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { payload: string; text: string };
  interactive?: {
    type: string;
    list_reply?: { id: string; title: string; description?: string };
    button_reply?: { id: string; title: string };
  };
}
