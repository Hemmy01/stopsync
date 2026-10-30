// When the /bus page starts or stops GPS sharing by itself. Pure.

export type AutoAction = "start" | "stop" | "none";

export interface AutoTrackingInput {
  /** The bus row's status, or null before it has loaded. */
  status: string | null;
  sharing: boolean;
  /** The driver pressed Stop during this trip: don't restart until the next release. */
  driverStopped: boolean;
  /** Location is blocked or unsupported: starting again would only fail again. */
  blocked: boolean;
}

/**
 * Released (on the way) → start sharing. Arrived at the end of the route → stop.
 * At the terminal the driver decides (a manual share there is left alone).
 */
export function autoTrackingAction({ status, sharing, driverStopped, blocked }: AutoTrackingInput): AutoAction {
  if (status === "on_the_way") return !sharing && !driverStopped && !blocked ? "start" : "none";
  if (status === "arrived") return sharing ? "stop" : "none";
  return "none";
}

/** Browser location permission, as far as the Permissions API can tell. */
export type GeoPermission = "granted" | "prompt" | "denied" | "unknown";

/** What to tell a driver whose location is blocked, for their phone. */
export function unblockLocationSteps(userAgent: string): string {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "iPhone: Settings → Privacy & Security → Location Services → Safari Websites → While Using the App, then reload this page.";
  }
  if (/Android/i.test(userAgent)) {
    return "Android: tap the icon left of the address bar → Permissions → Location → Allow, then reload this page.";
  }
  return "Allow location for this site in the browser's site settings (icon left of the address bar), then reload this page.";
}

/** Gaps longer than this while the page was hidden are reported to the driver. */
export const HIDDEN_GAP_WARN_MS = 10_000;

/** "1 min", "45 s": how long tracking was paused in the background. */
export function formatGap(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
}
