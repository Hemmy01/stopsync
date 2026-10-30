"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "./eta";
import { simulateBusPosition } from "./rpc";
import { DRIVE_STEP_MS, drivePath } from "./simulate-drive";
import { getSupabase } from "./supabase";

/** A copy of the record without one key. */
function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export interface DriveProgress {
  step: number;
  steps: number;
}

/**
 * Runs simulated drives from this browser tab, one step every DRIVE_STEP_MS. A drive ends at
 * the kiosk, when the server refuses a step (e.g. the bus already arrived) or on Stop.
 * Closing the tab stops it; the bus simply stays where it last was.
 */
export function useSimulatedDrives() {
  const [progress, setProgress] = useState<Readonly<Record<string, DriveProgress>>>({});
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const stop = useCallback((busId: string) => {
    clearTimeout(timers.current.get(busId));
    timers.current.delete(busId);
    setProgress((p) => without(p, busId));
  }, []);

  const start = useCallback(
    (busId: string, stops: readonly LatLng[]) => {
      const path = drivePath(stops);
      if (path.length === 0 || timers.current.has(busId)) return;
      setErrors((e) => without(e, busId));

      const tick = async (i: number) => {
        setProgress((p) => ({ ...p, [busId]: { step: i + 1, steps: path.length } }));
        const result = await simulateBusPosition(getSupabase(), busId, path[i]);
        if (!timers.current.has(busId)) return; // stopped meanwhile
        if (!result.ok) {
          setErrors((e) => ({ ...e, [busId]: result.message }));
          stop(busId);
          return;
        }
        if (result.data.status === "arrived" || i + 1 >= path.length) {
          stop(busId);
          return;
        }
        timers.current.set(busId, setTimeout(() => void tick(i + 1), DRIVE_STEP_MS));
      };
      timers.current.set(busId, setTimeout(() => void tick(0), 0));
    },
    [stop],
  );

  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const timer of running.values()) clearTimeout(timer);
      running.clear();
    };
  }, []);

  return { progress, errors, start, stop };
}
