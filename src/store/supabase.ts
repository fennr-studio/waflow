import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation } from "../flow/types.js";
import type { Store } from "./types.js";

/**
 * Supabase-backed conversation store. Requires one table (see sql/schema.sql):
 *
 *   wa_conversations(from text primary key, step text, data jsonb, updated_at timestamptz)
 *
 * Durable and shared across instances, so this is the right choice for
 * serverless deployments. Uses the service-role key — server-side only.
 * (Completed leads go to your CRM via a Bot.onLead handler, not here.)
 */
export class SupabaseStore implements Store {
  constructor(private readonly db: SupabaseClient) {}

  async getConversation(from: string): Promise<Conversation | undefined> {
    const { data, error } = await this.db
      .from("wa_conversations")
      .select("from, step, data, updated_at")
      .eq("from", from)
      .maybeSingle();
    if (error) throw new Error(`Supabase getConversation: ${error.message}`);
    if (!data) return undefined;
    return {
      from: data.from,
      step: data.step,
      data: (data.data ?? {}) as Record<string, string>,
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  async saveConversation(conv: Conversation): Promise<void> {
    const { error } = await this.db.from("wa_conversations").upsert(
      {
        from: conv.from,
        step: conv.step,
        data: conv.data,
        updated_at: new Date(conv.updatedAt).toISOString(),
      },
      { onConflict: "from" },
    );
    if (error) throw new Error(`Supabase saveConversation: ${error.message}`);
  }

  async clearConversation(from: string): Promise<void> {
    const { error } = await this.db.from("wa_conversations").delete().eq("from", from);
    if (error) throw new Error(`Supabase clearConversation: ${error.message}`);
  }
}
