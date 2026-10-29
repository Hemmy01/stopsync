"use client";

import { useEffect, useState } from "react";
import type { CancelReason } from "./cancel-reasons";
import { getSupabase } from "./supabase";

/** The reason list, loaded once (it only changes with a migration). */
export function useCancelReasons() {
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getSupabase()
      .from("cancel_reasons")
      .select("*")
      .order("sort_order")
      .then(({ data, error: err }) => {
        if (!live) return;
        if (err) setError(err.message);
        else setReasons(data);
      });
    return () => {
      live = false;
    };
  }, []);

  return { reasons, error };
}
