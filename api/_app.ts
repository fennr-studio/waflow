import type { Bot } from "../src/bot.js";
import { loadConfig } from "../src/config.js";
import { createBot } from "../src/createBot.js";

/**
 * Build (and cache) the Bot for Vercel's serverless functions. The promise is
 * memoized so warm invocations reuse the same instance; cold starts rebuild.
 * On serverless, conversation state MUST be durable — set STORAGE=supabase.
 */
let botPromise: Promise<Bot> | undefined;

export function getBot(): Promise<Bot> {
  botPromise ??= createBot(loadConfig());
  return botPromise;
}

export function verifyToken(): string {
  return loadConfig().WHATSAPP_VERIFY_TOKEN;
}
