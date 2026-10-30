"use client";

import { useEffect, useState } from "react";
import { parseLiveBoard, type LiveBoard } from "./live-board";
import { getSupabase, SUPABASE_CONFIG_ERROR } from "./supabase";

/** How often the public board refreshes. Polling, not Realtime: signed-out visitors can't subscribe to tables. */
export const LIVE_BOARD_REFRESH_MS = 5_000;

/** The public board, refreshed every few seconds while the page is visible. */
export function useLiveBoard(): { board: LiveBoard | null; error: string | null } {
  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [error, setError] = useState<string | null>(SUPABASE_CONFIG_ERROR);

  useEffect(() => {
    if (SUPABASE_CONFIG_ERROR) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        const { data, error: err } = await getSupabase().rpc("live_board");
        if (!live) return;
        if (err) setError(err.message);
        else {
          setBoard(parseLiveBoard(data));
          setError(null);
        }
      }
      if (live) timer = setTimeout(load, LIVE_BOARD_REFRESH_MS);
    };
    // Back on the tab: refresh straight away instead of waiting for the next tick.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };

    void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { board, error };
}
