import type { Conversation } from "../flow/types.js";
import type { Store } from "./types.js";

/**
 * Zero-dependency in-memory conversation store. Great for local dev and for
 * long-running single-instance servers (Railway/Fly/Render). State is lost on
 * restart and NOT shared across instances — on serverless (Vercel/Workers) use
 * a durable Store (e.g. SupabaseStore) instead. Includes lazy TTL eviction so
 * abandoned conversations don't leak memory.
 */
export class MemoryStore implements Store {
  private readonly conversations = new Map<string, Conversation>();

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
}
