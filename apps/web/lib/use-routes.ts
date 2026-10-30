"use client";

import { useEffect, useState } from "react";
import { loadRoutes, type Route } from "./routes";
import { getSupabase, SUPABASE_CONFIG_ERROR } from "./supabase";

/** Routes and their stops. Loaded once: they only change with a migration. */
export function useRoutes(): { routes: Route[]; error: string | null } {
  const [state, setState] = useState<{ routes: Route[]; error: string | null }>({
    routes: [],
    error: SUPABASE_CONFIG_ERROR,
  });

  useEffect(() => {
    if (SUPABASE_CONFIG_ERROR) return;
    let cancelled = false;
    loadRoutes(getSupabase())
      .then((routes) => !cancelled && setState({ routes, error: null }))
      .catch((err: unknown) => {
        if (!cancelled) setState({ routes: [], error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
