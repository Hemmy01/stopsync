// GPS sharing rules for the bus page. Pure.

/** update_bus_location is sent at most this often. */
export const MIN_SEND_INTERVAL_MS = 5_000;

/** Milliseconds to wait before the next send is allowed (0 = send now). */
export function msUntilNextSend(lastSentAt: number | null, now: number, minMs = MIN_SEND_INTERVAL_MS): number {
  if (lastSentAt === null) return 0;
  return Math.max(0, lastSentAt + minMs - now);
}

// GeolocationPositionError codes.
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

export interface GeoProblem {
  message: string;
  /** Fatal problems stop sharing; others are shown while we keep trying. */
  fatal: boolean;
}

export function geoProblem(code: number): GeoProblem {
  switch (code) {
    case PERMISSION_DENIED:
      return {
        message:
          "Location permission was denied. Allow location for this site in the browser settings, then tap Start sharing again. Location only works over HTTPS.",
        fatal: true,
      };
    case POSITION_UNAVAILABLE:
      return { message: "Can't get a GPS fix right now. Keep the phone outdoors; still trying…", fatal: false };
    case TIMEOUT:
      return { message: "GPS is slow to respond. Still trying…", fatal: false };
    default:
      return { message: "Location failed for an unknown reason.", fatal: true };
  }
}

/** "2.4 km" or "350 m". */
export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}
