"use client";

import { useEffect, useState } from "react";

export type WakeLockState = "on" | "off" | "unsupported" | "failed";

/**
 * Keeps the screen on while `active` (Screen Wake Lock API). The browser drops the
 * lock whenever the page is hidden, so it is requested again when the page returns.
 */
export function useWakeLock(active: boolean): WakeLockState {
  const [held, setHeld] = useState<"on" | "off" | "failed">("off");
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
        setHeld("on");
        lock.addEventListener("release", () => {
          if (!cancelled) setHeld("off");
        });
      } catch {
        // Low battery mode, or the browser refused: the driver keeps the screen on by hand.
        if (!cancelled) setHeld("failed");
      }
    };
    const onVisibility = () => void request();

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
      setHeld("off");
    };
  }, [active]);

  if (!active) return "off";
  return supported ? held : "unsupported";
}
