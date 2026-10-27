"use client";

import { useEffect, useState } from "react";

/**
 * Current time, refreshed every `intervalMs` (for "waited 12 min" labels).
 * Null until mounted: the time must not be baked into the prerendered page.
 */
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
