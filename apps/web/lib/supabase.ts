import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type StopSyncClient = SupabaseClient<Database>;

export const STOP_ID = process.env.NEXT_PUBLIC_STOP_ID ?? "STOP-01";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Message for the error banner when env values are missing, else null. */
export const SUPABASE_CONFIG_ERROR =
  url && anonKey
    ? null
    : "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local.";

let client: StopSyncClient | null = null;

/** Browser Supabase client (anon key only, no sessions: there is no auth). */
export function getSupabase(): StopSyncClient {
  if (client) return client;
  if (!url || !anonKey) throw new Error(SUPABASE_CONFIG_ERROR ?? "Supabase is not configured.");

  client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
