/**
 * waflow — a config-driven WhatsApp Cloud API flow engine.
 *
 * Public API surface for embedding in your own server (Vercel/Express/etc.).
 */
export { Bot } from "./bot.js";
export type { LeadHandler } from "./bot.js";
export { loadConfig } from "./config.js";
export type { Config } from "./config.js";

export { FlowEngine } from "./flow/engine.js";
export type {
  Choice,
  ChoiceStep,
  Conversation,
  Flow,
  FlowData,
  Lead,
  MessageStep,
  Step,
  StepOutcome,
  TextStep,
  UserInput,
} from "./flow/types.js";

export { WhatsAppClient } from "./whatsapp/client.js";
export type { InboundMessage, OutgoingMessage } from "./whatsapp/types.js";

export { verifySignature, verifySubscription } from "./webhook/verify.js";
export { parseInbound } from "./webhook/parse.js";

export type { Store } from "./store/types.js";
export { MemoryStore } from "./store/memory.js";
export { SupabaseStore } from "./store/supabase.js";
export { createStore } from "./store/factory.js";

export { fennrFlow } from "./flows/fennr.js";

// Integrations
export { fennrCrmHandler, toLeadRow } from "./integrations/fennrCrm.js";
