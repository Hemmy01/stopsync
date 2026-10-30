"use client";

import { countByDestination, type Bus } from "./departures";
import type { QueueToken } from "./queue";
import { STOP_ID, type StopSyncClient } from "./supabase";
import { unwrap, useRealtimeData, type RealtimeTable } from "./use-realtime-data";

export interface LiveNetwork {
  buses: Bus[];
  /** This kiosk's tickets: waiting, and boarded on a bus that is still on its trip. */
  tokens: QueueToken[];
  waiting: Record<string, number>;
  loading: boolean;
  error: string | null;
}

const TABLES: readonly RealtimeTable[] = ["buses", "queue_tokens"];

async function loadNetwork(supabase: StopSyncClient) {
  const [buses, tokens] = await Promise.all([
    supabase.from("buses").select("*").order("id"),
    // This kiosk's queue; the dashboard shows the whole network.
    supabase
      .from("queue_tokens")
      .select("id, code, destination, status, bus_id, created_at")
      .eq("stop_id", STOP_ID)
      .or("status.eq.waiting,and(status.eq.boarded,bus_id.not.is.null)"),
  ]);
  const rows = unwrap(tokens);
  return {
    buses: unwrap(buses),
    tokens: rows,
    waiting: countByDestination(rows.filter((t) => t.status === "waiting")),
  };
}

/** Live buses and waiting counts per destination (kiosk strip and ticket). */
export function useLiveNetwork(): LiveNetwork {
  const { data, loading, error } = useRealtimeData(TABLES, loadNetwork);
  return { buses: data?.buses ?? [], tokens: data?.tokens ?? [], waiting: data?.waiting ?? {}, loading, error };
}
