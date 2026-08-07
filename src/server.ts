import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Bot } from "./bot.js";
import { loadConfig } from "./config.js";
import { fennrFlow } from "./flows/fennr.js";
import { createStore } from "./store/factory.js";
import { verifySubscription } from "./webhook/verify.js";

/**
 * Reference server. It's intentionally thin — all the logic lives in `Bot`,
 * so you can drop the same Bot into Vercel, Cloudflare Workers, Express, etc.
 */
export async function createServer() {
  const cfg = loadConfig();
  const store = await createStore(cfg);
  const flow = fennrFlow({ calendlyUrl: cfg.CALENDLY_URL, portfolioUrl: cfg.PORTFOLIO_URL });
  const bot = new Bot(cfg, store, flow);

  // Always log completed leads.
  bot.onLead((lead) => {
    console.log(`[waflow] 🎉 new lead from ${lead.from}:`, lead.data);
  });

  // Unified CRM: if Supabase is configured, push leads into the same `leads`
  // table the website uses, so they show up in /admin alongside web leads.
  if (cfg.SUPABASE_URL && cfg.SUPABASE_SERVICE_ROLE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    const { fennrCrmHandler } = await import("./integrations/fennrCrm.js");
    const db = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    bot.onLead(fennrCrmHandler(db, cfg.CRM_LEADS_TABLE));
    console.log(`[waflow] CRM enabled → leads insert into "${cfg.CRM_LEADS_TABLE}"`);
  }

  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  // Meta's subscription handshake.
  app.get("/webhook", (c) => {
    const challenge = verifySubscription(
      {
        mode: c.req.query("hub.mode"),
        token: c.req.query("hub.verify_token"),
        challenge: c.req.query("hub.challenge"),
      },
      cfg.WHATSAPP_VERIFY_TOKEN,
    );
    return challenge ? c.text(challenge, 200) : c.text("Forbidden", 403);
  });

  // Inbound messages. Verify the signature over the RAW body, always 200 fast.
  app.post("/webhook", async (c) => {
    const raw = await c.req.text();
    if (!bot.verify(raw, c.req.header("x-hub-signature-256"))) {
      return c.text("Invalid signature", 401);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return c.text("Bad JSON", 400);
    }
    // Ack immediately; process in the background so Meta doesn't retry on slow sends.
    void bot.handleWebhook(payload);
    return c.text("EVENT_RECEIVED", 200);
  });

  return { app, cfg, bot, store };
}

// Boot when run directly (node dist/server.js / tsx src/server.ts).
if (import.meta.url === `file://${process.argv[1]}`) {
  createServer()
    .then(({ app, cfg }) => {
      serve({ fetch: app.fetch, port: cfg.PORT });
      console.log(`[waflow] listening on :${cfg.PORT}  (webhook: /webhook)`);
    })
    .catch((err) => {
      console.error("[waflow] failed to start:", err);
      process.exit(1);
    });
}
