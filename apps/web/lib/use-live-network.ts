"use client";

import { countByDestination, type Bus } from "./departures";
import { STOP_ID, type StopSyncClient } from "./supabase";
import { unwrap, useRealtimeData, type RealtimeTable } from "./use-realtime-data";

export interface LiveNetwork {
  buses: Bus[];
  waiting: Record<string, number>;
  loading: boolean;
  error: string | null;
}

const TABLES: readonly RealtimeTable[] = ["buses", "queue_tokens"];

async function loadNetwork(supabase: StopSyncClient) {
  const [buses, waiting] = await Promise.all([
    supabase.from("buses").select("*").order("id"),
    // People waiting at this kiosk; the dashboard shows the whole network.
    supabase.from("queue_tokens").select("destination").eq("status", "waiting").eq("stop_id", STOP_ID),
  ]);
  return { buses: unwrap(buses), waiting: countByDestination(unwrap(waiting)) };
}

/** Live buses and waiting counts per destination (kiosk strip and ticket). */
export function useLiveNetwork(): LiveNetwork {
  const { data, loading, error } = useRealtimeData(TABLES, loadNetwork);
  return { buses: data?.buses ?? [], waiting: data?.waiting ?? {}, loading, error };
}
