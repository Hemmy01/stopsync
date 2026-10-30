"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Database } from "./database.types";
import { getSupabase, SUPABASE_CONFIG_ERROR, type StopSyncClient } from "./supabase";

export type RealtimeTable = keyof Database["public"]["Tables"];

export interface RealtimeData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Load again now (e.g. right after an action). */
  reload: () => void;
}

const DEBOUNCE_MS = 250;

/**
 * Loads data and reloads it (debounced) whenever any of `tables` changes via
 * Supabase Realtime, so the screen always shows what the database says.
 * `load` must be stable (define it at module level) and throw on error.
 */
export function useRealtimeData<T>(
  tables: readonly RealtimeTable[],
  load: (client: StopSyncClient) => Promise<T>,
): RealtimeData<T> {
  const [state, setState] = useState<Omit<RealtimeData<T>, "reload">>({
    data: null,
    loading: SUPABASE_CONFIG_ERROR === null,
    error: SUPABASE_CONFIG_ERROR,
  });
  const reloadRef = useRef<() => void>(() => {});
  const tablesKey = tables.join(",");

  useEffect(() => {
    if (SUPABASE_CONFIG_ERROR) return;
    const supabase = getSupabase();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      try {
        const data = await load(supabase);
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }));
        }
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void run(), DEBOUNCE_MS);
    };
    reloadRef.current = schedule;

    void run();

    let channel = supabase.channel(`rt-${tablesKey}-${Math.random().toString(36).slice(2)}`);
    for (const table of tablesKey.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") schedule();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setState((s) => ({ ...s, error: "Live updates were interrupted. Retrying…" }));
      }
    });

    window.addEventListener("online", schedule);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      reloadRef.current = () => {};
      window.removeEventListener("online", schedule);
      void supabase.removeChannel(channel);
    };
  }, [tablesKey, load]);

  const reload = useCallback(() => reloadRef.current(), []);
  return { ...state, reload };
}

/** Throw a query error so useRealtimeData can show it. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("No data returned");
  return result.data;
}
