import type { Conversation } from "../flow/types.js";

/**
 * Persistence boundary for **conversation state**, keyed by the user's phone
 * number. Swap the implementation (memory, Supabase, Redis…) without touching
 * the engine or server.
 *
 * Note: completed *leads* are delivered via `Bot.onLead(...)` handlers, not
 * the Store. That keeps state and lead-delivery cleanly separated — your CRM
 * is just a handler (see `integrations/fennrCrm.ts`).
 */
export interface Store {
  getConversation(from: string): Promise<Conversation | undefined>;
  saveConversation(conv: Conversation): Promise<void>;
  clearConversation(from: string): Promise<void>;
}
