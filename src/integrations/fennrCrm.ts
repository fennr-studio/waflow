import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadHandler } from "../bot.js";
import type { Lead } from "../flow/types.js";

/**
 * Land WhatsApp-bot leads in the SAME `leads` table the Fennr website uses,
 * so they appear in the unified /admin CRM alongside brief/contact leads.
 *
 * The flow stores compact ids (e.g. "logo", "50k-1L", "asap"); we translate
 * them to the exact human labels the website form uses, so /admin renders
 * everything consistently. `source` is set to "whatsapp" so you can tell them
 * apart and filter.
 *
 * Requires: `email` nullable on the leads table (supabase-migration-3.sql),
 * since WhatsApp leads have no email — the phone is the contact.
 */
export function fennrCrmHandler(db: SupabaseClient, table = "leads"): LeadHandler {
  return async (lead: Lead) => {
    const row = toLeadRow(lead);
    const { error } = await db.from(table).insert(row);
    if (error) throw new Error(`fennrCrm insert: ${error.message}`);
  };
}

/** Exported for testing: pure mapping from a waflow Lead to a leads row. */
export function toLeadRow(lead: Lead): Record<string, unknown> {
  const d = lead.data;
  const service = SERVICE_LABELS[d.service ?? ""];
  return {
    name: (lead.name ?? d.name ?? "WhatsApp lead").trim(),
    email: null, // WhatsApp leads have no email; phone is the contact
    phone: toE164(lead.from),
    interests: service ? [service] : null,
    budget: BUDGET_LABELS[d.budget ?? ""] ?? null,
    timeline: TIMELINE_LABELS[d.timeline ?? ""] ?? null,
    message: "Lead captured via WhatsApp bot",
    source: "whatsapp",
  };
}

/** WhatsApp `from` is E.164 without '+'; store it with a leading '+'. */
function toE164(from: string): string {
  const digits = from.replace(/\D/g, "");
  return digits ? `+${digits}` : from;
}

const SERVICE_LABELS: Record<string, string> = {
  web: "Web Development",
  logo: "Logo & Identity",
  seo: "SEO & Visibility",
  photo: "Photography",
  design: "Graphic Design",
  brand: "Brand Strategy",
  ai: "AI & Strategy",
};

const BUDGET_LABELS: Record<string, string> = {
  under50k: "Under ₹50k",
  "50k-1L": "₹50k – ₹1L",
  "1L-3L": "₹1L – ₹3L",
  "3L+": "₹3L+",
  unsure: "Not sure yet",
};

const TIMELINE_LABELS: Record<string, string> = {
  asap: "ASAP",
  "1-3m": "1–3 months",
  "3-6m": "3–6 months",
  exploring: "Just exploring",
};
