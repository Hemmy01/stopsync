import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type StopSyncClient = SupabaseClient<Database>;

export const STOP_ID = process.env.NEXT_PUBLIC_STOP_ID ?? "STOP-01";

let client: StopSyncClient | null = null;

/** Browser Supabase client (anon key only, no sessions: there is no auth). */
export function getSupabase(): StopSyncClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local.",
    );
  }

  client = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
