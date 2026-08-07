import type { Conversation, Lead } from "../flow/types.js";
import type { Store } from "./types.js";

/**
 * Zero-dependency in-memory store. Great for local dev and tests. State is
 * lost on restart and not shared across instances — use a durable Store
 * (e.g. Supabase) in production. Includes lazy TTL eviction so stale
 * conversations don't leak memory.
 */
export class MemoryStore implements Store {
  private readonly conversations = new Map<string, Conversation>();
  private readonly leads: Lead[] = [];

  constructor(private readonly ttlMs = 1000 * 60 * 60 * 24) {}

  async getConversation(from: string): Promise<Conversation | undefined> {
    const c = this.conversations.get(from);
    if (c && Date.now() - c.updatedAt > this.ttlMs) {
      this.conversations.delete(from);
      return undefined;
    }
    return c;
  }

  async saveConversation(conv: Conversation): Promise<void> {
    this.conversations.set(conv.from, conv);
  }

  async clearConversation(from: string): Promise<void> {
    this.conversations.delete(from);
  }

  async saveLead(lead: Lead): Promise<void> {
    this.leads.push(lead);
  }

  /** Test/inspection helper. */
  allLeads(): readonly Lead[] {
    return this.leads;
  }
}
