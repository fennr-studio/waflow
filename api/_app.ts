import { Bot } from "../src/bot.js";
import { loadConfig } from "../src/config.js";
import { fennrFlow } from "../src/flows/fennr.js";
import { createStore } from "../src/store/factory.js";

/**
 * Build (and cache) the Bot for Vercel's serverless functions. The promise is
 * memoized so warm invocations reuse the same instance; cold starts rebuild.
 * On serverless, conversation state MUST be durable — set STORAGE=supabase.
 */
let botPromise: Promise<Bot> | undefined;

export function getBot(): Promise<Bot> {
  botPromise ??= build();
  return botPromise;
}

export function verifyToken(): string {
  return loadConfig().WHATSAPP_VERIFY_TOKEN;
}

async function build(): Promise<Bot> {
  const cfg = loadConfig();
  const store = await createStore(cfg);
  const bot = new Bot(cfg, store, fennrFlow({ calendlyUrl: cfg.CALENDLY_URL, portfolioUrl: cfg.PORTFOLIO_URL }));

  bot.onLead((lead) => console.log(`[waflow] 🎉 lead from ${lead.from}:`, lead.data));

  if (cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    const { fennrCrmHandler } = await import("../src/integrations/fennrCrm.js");
    const db = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    bot.onLead(fennrCrmHandler(db, cfg.CRM_LEADS_TABLE));
  }
  return bot;
}
