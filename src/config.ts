import { z } from "zod";

/**
 * Validated runtime configuration. Fail fast at boot if anything required
 * is missing, rather than surfacing a confusing error mid-conversation.
 */
const schema = z.object({
  WHATSAPP_TOKEN: z.string().min(1, "WHATSAPP_TOKEN is required"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1, "WHATSAPP_PHONE_NUMBER_ID is required"),
  WHATSAPP_APP_SECRET: z.string().min(1, "WHATSAPP_APP_SECRET is required"),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1, "WHATSAPP_VERIFY_TOKEN is required"),
  WHATSAPP_API_VERSION: z.string().default("v22.0"),
  PORT: z.coerce.number().default(3000),
  STORAGE: z.enum(["memory", "supabase"]).default("memory"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  // Table that completed leads are inserted into (unified CRM). Defaults to
  // the same `leads` table the Fennr website uses.
  CRM_LEADS_TABLE: z.string().default("leads"),
  CALENDLY_URL: z.string().url().default("https://calendly.com/fennrstudio/15min"),
  PORTFOLIO_URL: z.string().url().default("https://www.fennrstudio.com"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  const cfg = parsed.data;
  if (cfg.STORAGE === "supabase" && (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error("STORAGE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  return cfg;
}
