"use client";

import { useCallback, useEffect, useState } from "react";
import type { GeoPermission } from "./auto-tracking";

/**
 * The location permission for this site, kept live, plus `ask()` to show the browser's
 * prompt now (while the driver is looking) rather than when HQ releases the bus.
 */
export function useGeoPermission(): { permission: GeoPermission; ask: () => void } {
  const [permission, setPermission] = useState<GeoPermission>("unknown");

  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const update = () => status && setPermission(status.state);
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((s) => {
        if (cancelled) return;
        status = s;
        update();
        s.addEventListener("change", update);
      })
      .catch(() => {
        // Older Safari: no Permissions API; we learn the answer from the first fix.
      });
    return () => {
      cancelled = true;
      status?.removeEventListener("change", update);
    };
  }, []);

  const ask = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      () => setPermission("granted"),
      (err) => setPermission(err.code === err.PERMISSION_DENIED ? "denied" : "prompt"),
      { enableHighAccuracy: true, timeout: 20_000 },
    );
  }, []);

  return { permission, ask };
}
