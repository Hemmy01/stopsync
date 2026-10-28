"use client";

import type { BusEvent, ConfigRow, Decision, Token } from "./dashboard";
import type { Tables } from "./database.types";
import type { Bus } from "./departures";
import type { StopSyncClient } from "./supabase";
import { kigaliDayStartISO } from "./time";
import { unwrap, useRealtimeData, type RealtimeTable } from "./use-realtime-data";

export interface DashboardData {
  dayStart: string;
  destinations: Tables<"destinations">[];
  /** Waiting tokens (any day) plus every token created or boarded today. */
  tokens: Token[];
  buses: Bus[];
  decisions: Decision[];
  events: BusEvent[];
  config: ConfigRow[];
}

const TABLES: readonly RealtimeTable[] = ["queue_tokens", "buses", "dispatch_decisions", "bus_events", "config"];

async function loadDashboard(supabase: StopSyncClient): Promise<DashboardData> {
  const dayStart = kigaliDayStartISO();
  const [destinations, tokens, buses, decisions, events, config] = await Promise.all([
    supabase.from("destinations").select("*").order("sort_order"),
    supabase
      .from("queue_tokens")
      .select("*")
      .or(`status.eq.waiting,created_at.gte.${dayStart},boarded_at.gte.${dayStart}`)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("buses").select("*").order("id"),
    supabase.from("dispatch_decisions").select("*").order("id", { ascending: false }).limit(100),
    supabase.from("bus_events").select("*").order("id", { ascending: false }).limit(50),
    supabase.from("config").select("*").order("key"),
  ]);
  return {
    dayStart,
    destinations: unwrap(destinations),
    tokens: unwrap(tokens),
    buses: unwrap(buses),
    decisions: unwrap(decisions),
    events: unwrap(events),
    config: unwrap(config),
  };
}

export function useDashboardData() {
  return useRealtimeData(TABLES, loadDashboard);
}
