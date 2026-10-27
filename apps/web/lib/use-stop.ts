"use client";

import { useEffect, useState } from "react";
import { getSupabase, SUPABASE_CONFIG_ERROR } from "./supabase";

/** Display name of a stop, falling back to its id until loaded. */
export function useStopName(stopId: string): string {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (SUPABASE_CONFIG_ERROR) return;
    let cancelled = false;
    void getSupabase()
      .from("stops")
      .select("name")
      .eq("id", stopId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setName(data.name);
      });
    return () => {
      cancelled = true;
    };
  }, [stopId]);

  return name ?? stopId;
}
