"use client";

import { useEffect, useState } from "react";
import { countByDestination, type Bus } from "./departures";
import { getSupabase, SUPABASE_CONFIG_ERROR } from "./supabase";

export interface LiveNetwork {
  buses: Bus[];
  waiting: Record<string, number>;
  loading: boolean;
  error: string | null;
}

const REFETCH_DEBOUNCE_MS = 250;

/**
 * Live buses and waiting counts per destination. Any Realtime change to
 * buses or queue_tokens triggers a (debounced) refetch, so the view is always
 * whatever the database says.
 */
export function useLiveNetwork(): LiveNetwork {
  const [state, setState] = useState<LiveNetwork>({
    buses: [],
    waiting: {},
    loading: SUPABASE_CONFIG_ERROR === null,
    error: SUPABASE_CONFIG_ERROR,
  });

  useEffect(() => {
    if (SUPABASE_CONFIG_ERROR) return;
    const supabase = getSupabase();

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      const [busesRes, waitingRes] = await Promise.all([
        supabase.from("buses").select("*").order("id"),
        supabase.from("queue_tokens").select("destination").eq("status", "waiting"),
      ]);
      if (cancelled) return;
      const error = busesRes.error ?? waitingRes.error;
      if (error) {
        setState((s) => ({ ...s, loading: false, error: error.message }));
        return;
      }
      setState({
        buses: busesRes.data ?? [],
        waiting: countByDestination(waitingRes.data ?? []),
        loading: false,
        error: null,
      });
    }

    const scheduleLoad = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), REFETCH_DEBOUNCE_MS);
    };

    void load();

    const channel = supabase
      .channel(`live-network-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "buses" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tokens" }, scheduleLoad)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") scheduleLoad();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setState((s) => ({ ...s, error: "Live updates were interrupted. Retrying…" }));
        }
      });

    window.addEventListener("online", scheduleLoad);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", scheduleLoad);
      void supabase.removeChannel(channel);
    };
  }, []);

  return state;
}
