import type { OutgoingMessage } from "../whatsapp/types.js";

/**
 * A flow is a config-driven conversation: a map of named steps plus a start
 * step. The engine keeps per-user state ({ step, data }) and moves through
 * steps based on what the user replies. Businesses define flows as data —
 * they never touch the engine.
 */

/** Mutable bag of everything captured so far in a conversation. */
export type FlowData = Record<string, string>;

/** What the user sent, normalized. Either a tapped option id or free text. */
export interface UserInput {
  replyId?: string;
  text?: string;
  name?: string;
}

/** A selectable option in a `choice` step. */
export interface Choice {
  /** Stable id echoed back by WhatsApp; also accepted as a typed shortcut. */
  id: string;
  title: string;
  description?: string;
  /** Optional value stored instead of the id (defaults to the id). */
  value?: string;
  /** Extra keywords that also match this option when the user types. */
  aliases?: string[];
}

interface BaseStep {
  /** Optional key under which this step's answer is stored in FlowData. */
  store?: string;
  /** Next step id, or a function to branch on the captured data. */
  next?: string | ((data: FlowData) => string);
}

/** Present options as an interactive list or reply buttons; expect a pick. */
export interface ChoiceStep extends BaseStep {
  type: "choice";
  render: "list" | "buttons";
  body: string;
  header?: string;
  footer?: string;
  /** List "open" button label (list render only). Max 20 chars. */
  button?: string;
  choices: Choice[];
}

/** Ask an open question and capture the free-text answer. */
export interface TextStep extends BaseStep {
  type: "text";
  body: string;
}

/** Send message(s) and immediately move on (or end). No input expected. */
export interface MessageStep extends BaseStep {
  type: "message";
  /** Static text, or a builder that can read captured data. */
  body: string | ((data: FlowData) => string);
  end?: boolean;
}

export type Step = ChoiceStep | TextStep | MessageStep;

export interface Flow {
  id: string;
  start: string;
  steps: Record<string, Step>;
  /** Sent when input doesn't match a choice. Defaults to a generic nudge. */
  fallback?: string;
}

/** Per-user conversation state persisted by a Store. */
export interface Conversation {
  from: string;
  step: string;
  data: FlowData;
  updatedAt: number;
}

/** Result of feeding one input into the engine. */
export interface StepOutcome {
  messages: OutgoingMessage[];
  conversation: Conversation;
  /** True when the flow reached an `end` step this turn. */
  completed: boolean;
}

/** A captured lead, emitted when a flow completes. */
export interface Lead {
  from: string;
  name?: string;
  data: FlowData;
  completedAt: number;
}
