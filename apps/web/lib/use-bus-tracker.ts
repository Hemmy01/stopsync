"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { geoProblem, msUntilNextSend } from "./geo";
import { jsonNumber, jsonString, updateBusLocation } from "./rpc";
import { getSupabase } from "./supabase";

export interface LocationResult {
  status: string;
  distanceM: number | null;
  etaMinutes: number | null;
  boardedCount: number | null;
}

export interface TrackerState {
  sharing: boolean;
  /** Accuracy of the latest fix, in metres. */
  accuracyM: number | null;
  lastSentAt: Date | null;
  lastResult: LocationResult | null;
  /** Non-fatal GPS or send problem, shown while sharing continues. */
  warning: string | null;
  /** Fatal problem: sharing stopped. */
  error: string | null;
}

const INITIAL: TrackerState = {
  sharing: false,
  accuracyM: null,
  lastSentAt: null,
  lastResult: null,
  warning: null,
  error: null,
};

/**
 * Shares the phone's GPS for one bus: watchPosition, and update_bus_location
 * at most every 5 s. A throttled fix is not lost: the newest one is sent as
 * soon as the window opens.
 */
export function useBusTracker(busId: string | null) {
  const [state, setState] = useState<TrackerState>(INITIAL);

  const watchId = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSentAt = useRef<number | null>(null);
  const latest = useRef<GeolocationPosition | null>(null);
  const inFlight = useRef(false);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    clearTimeout(timer.current);
    latest.current = null;
    setState((s) => ({ ...s, sharing: false, warning: null }));
  }, []);

  const send = useCallback(async () => {
    const position = latest.current;
    if (!busId || !position || inFlight.current) return;
    latest.current = null;
    inFlight.current = true;
    lastSentAt.current = Date.now();

    const result = await updateBusLocation(
      getSupabase(),
      busId,
      position.coords.latitude,
      position.coords.longitude,
    ).catch((err: unknown) => ({ ok: false as const, message: err instanceof Error ? err.message : "Network error" }));
    inFlight.current = false;

    if (!result.ok) {
      setState((s) => ({ ...s, warning: `Couldn't send location: ${result.message}` }));
      return;
    }
    const d = result.data;
    setState((s) => ({
      ...s,
      warning: null,
      lastSentAt: new Date(),
      lastResult: {
        status: jsonString(d, "status") ?? "stored",
        distanceM: jsonNumber(d, "distance_m"),
        etaMinutes: jsonNumber(d, "eta_minutes"),
        boardedCount: jsonNumber(d, "boarded_count"),
      },
    }));
  }, [busId]);

  const onPosition = useCallback(
    (position: GeolocationPosition) => {
      latest.current = position;
      setState((s) => ({ ...s, accuracyM: Math.round(position.coords.accuracy), warning: null }));
      clearTimeout(timer.current);
      const wait = msUntilNextSend(lastSentAt.current, Date.now());
      if (wait === 0) void send();
      else timer.current = setTimeout(() => void send(), wait);
    },
    [send],
  );

  const onError = useCallback(
    (err: GeolocationPositionError) => {
      const problem = geoProblem(err.code);
      if (problem.fatal) {
        stop();
        setState((s) => ({ ...s, error: problem.message }));
      } else {
        setState((s) => ({ ...s, warning: problem.message }));
      }
    },
    [stop],
  );

  const start = useCallback(() => {
    if (!busId || watchId.current !== null) return;
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "This browser has no location support." }));
      return;
    }
    if (!window.isSecureContext) {
      setState((s) => ({
        ...s,
        error: "Location only works over HTTPS. Open the deployed (https://) address on the phone.",
      }));
      return;
    }
    lastSentAt.current = null;
    setState((s) => ({ ...s, sharing: true, error: null, warning: "Waiting for the first GPS fix…" }));
    watchId.current = navigator.geolocation.watchPosition(onPosition, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000,
    });
  }, [busId, onPosition, onError]);

  // Switching bus or leaving the page (hidden or unmounted) stops sharing.
  useEffect(() => stop, [busId, stop]);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, start, stop, reset };
}
