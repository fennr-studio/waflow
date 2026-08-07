/**
 * Minimal, strongly-typed models for the parts of the WhatsApp Cloud API
 * this engine uses. Field limits reflect Meta's documented constraints.
 */

// ---------- Outgoing (what we send) ----------

export interface TextMessage {
  kind: "text";
  body: string; // max 4096
  previewUrl?: boolean;
}

export interface ListRow {
  id: string; // max 200 chars, echoed back in the webhook
  title: string; // max 24
  description?: string; // max 72
}

export interface ListSection {
  title?: string; // max 24
  rows: ListRow[];
}

/** Interactive list — single select, up to 10 rows total across sections. */
export interface ListMessage {
  kind: "list";
  body: string; // max 4096
  button: string; // max 20
  sections: ListSection[];
  header?: string; // max 60
  footer?: string; // max 60
}

export interface ReplyButton {
  id: string; // max 256
  title: string; // max 20
}

/** Reply buttons — up to 3. */
export interface ButtonsMessage {
  kind: "buttons";
  body: string;
  buttons: ReplyButton[]; // 1..3
  header?: string;
  footer?: string;
}

export type OutgoingMessage = TextMessage | ListMessage | ButtonsMessage;

// ---------- Incoming (normalized webhook) ----------

/** A single inbound message, normalized to what the flow engine cares about. */
export interface InboundMessage {
  /** WhatsApp user's phone number in E.164 without '+', e.g. "919876543210". */
  from: string;
  /** WhatsApp message id, used for read receipts and de-duplication. */
  messageId: string;
  /** Best-effort display name from the contacts payload. */
  name?: string;
  /** Unix timestamp (seconds) of the message. */
  timestamp: number;
  /**
   * Normalized reply:
   * - text  → free text the user typed
   * - reply → an id from a list row or reply button the user tapped
   */
  text?: string;
  replyId?: string;
  replyTitle?: string;
  /**
   * Parsed `nfm_reply.response_json` when the user submits a WhatsApp Flow
   * form. Keys are the Flow's field names; multi-selects are string arrays.
   */
  flowResponse?: Record<string, unknown>;
}
