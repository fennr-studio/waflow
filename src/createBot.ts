import { Bot } from "./bot.js";
import type { Config } from "./config.js";
import { fennrFlow } from "./flows/fennr.js";
import { fennrForm } from "./flows/fennrForm.js";
import { createStore } from "./store/factory.js";
import type { Store } from "./store/types.js";

/**
 * Build a fully-wired Bot from config: conversational flow by default, plus
 * — WhatsApp Flow "form mode" when WHATSAPP_FLOW_ID is set, and
 * — unified CRM (insert into the website's leads table) when Supabase is set.
 *
 * Both the reference server and the Vercel function use this, so behaviour is
 * identical across deployments.
 */
export async function createBot(cfg: Config, store?: Store): Promise<Bot> {
  const st = store ?? (await createStore(cfg));
  const bot = new Bot(cfg, st, fennrFlow({ calendlyUrl: cfg.CALENDLY_URL, portfolioUrl: cfg.PORTFOLIO_URL }));

  bot.onLead((lead) => console.log(`[waflow] 🎉 lead from ${lead.from}:`, lead.data));

  if (cfg.WHATSAPP_FLOW_ID) {
    bot.useForm(fennrForm({ flowId: cfg.WHATSAPP_FLOW_ID, calendlyUrl: cfg.CALENDLY_URL, portfolioUrl: cfg.PORTFOLIO_URL }));
  }

  if (cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    const { fennrCrmHandler } = await import("./integrations/fennrCrm.js");
    const db = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    bot.onLead(fennrCrmHandler(db, cfg.CRM_LEADS_TABLE));
  }
  return bot;
}
