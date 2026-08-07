import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, Lead } from "../flow/types.js";
import type { Store } from "./types.js";

/**
 * Supabase-backed store. Requires two tables (see sql/schema.sql):
 *
 *   wa_conversations(from text primary key, step text, data jsonb, updated_at timestamptz)
 *   wa_leads(id uuid default gen_random_uuid() primary key, "from" text, name text,
 *            data jsonb, completed_at timestamptz)
 *
 * Uses the service-role key, so keep this server-side only.
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

  async saveLead(lead: Lead): Promise<void> {
    const { error } = await this.db.from("wa_leads").insert({
      from: lead.from,
      name: lead.name ?? null,
      data: lead.data,
      completed_at: new Date(lead.completedAt).toISOString(),
    });
    if (error) throw new Error(`Supabase saveLead: ${error.message}`);
  }
}
