import type { Config } from "../config.js";
import { MemoryStore } from "./memory.js";
import type { Store } from "./types.js";

/** Build the configured Store. Supabase is loaded lazily (optional dep). */
export async function createStore(cfg: Config): Promise<Store> {
  if (cfg.STORAGE === "supabase") {
    const { createClient } = await import("@supabase/supabase-js");
    const { SupabaseStore } = await import("./supabase.js");
    const db = createClient(cfg.SUPABASE_URL!, cfg.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    return new SupabaseStore(db);
  }
  return new MemoryStore();
}
