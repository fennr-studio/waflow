import type { Conversation, Lead } from "../flow/types.js";

/**
 * Persistence boundary. Swap the implementation (memory, Supabase, Redis…)
 * without touching the engine or server. Conversation state is keyed by the
 * user's phone number; leads are append-only.
 */
export interface Store {
  getConversation(from: string): Promise<Conversation | undefined>;
  saveConversation(conv: Conversation): Promise<void>;
  clearConversation(from: string): Promise<void>;
  saveLead(lead: Lead): Promise<void>;
}
