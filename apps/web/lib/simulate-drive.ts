// "Simulate drive": the path a released bus follows from its terminal to the kiosk. Pure.
// Every stop is on the path exactly, so boarding along the route and arrival at the kiosk
// happen just as with real GPS.

import { haversineMeters, type LatLng } from "./eta";

/** Steps for a whole route: about a minute at one step every 1.5 s. */
export const DRIVE_STEPS = 40;
export const DRIVE_STEP_MS = 1_500;

/**
 * Points from the first stop (terminal) to the last (kiosk). Segments get steps in proportion
 * to their length (at least one), and each stop is included exactly once.
 */
export function drivePath(stops: readonly LatLng[], steps = DRIVE_STEPS): LatLng[] {
  if (stops.length === 0) return [];
  const legs = stops.slice(1).map((to, i) => ({ from: stops[i], to, m: haversineMeters(stops[i], to) }));
  const total = legs.reduce((sum, leg) => sum + leg.m, 0);
  const path: LatLng[] = [{ lat: stops[0].lat, lng: stops[0].lng }];
  for (const leg of legs) {
    const n = Math.max(1, total > 0 ? Math.round((steps * leg.m) / total) : 1);
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      path.push({ lat: leg.from.lat + (leg.to.lat - leg.from.lat) * t, lng: leg.from.lng + (leg.to.lng - leg.from.lng) * t });
    }
  }
  return path;
}
