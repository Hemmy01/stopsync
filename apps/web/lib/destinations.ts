// Single source for destination display config in the web app.
// The same mapping lives in supabase/seed.sql and firmware/kiosk_node/config.h;
// tests/firmware-config.test.ts checks config.h against this file.

export interface Destination {
  code: string;
  name: string;
  route: string;
  /** CSS variable holding the route colour. */
  color: string;
  /** Edge Impulse voice model label. */
  voiceLabel: string;
  /** Tap pattern label (rule detector today, future Edge Impulse tap model). */
  gestureLabel: string;
  /** What the passenger does, e.g. "Tap once". */
  gestureHint: string;
}

export const DESTINATIONS = [
  {
    code: "NYA",
    name: "Nyabugogo",
    route: "R1",
    color: "var(--route-1)",
    voiceLabel: "nyabugogo",
    gestureLabel: "three_taps",
    gestureHint: "Tap 3 times",
  },
  {
    code: "REM",
    name: "Remera",
    route: "R2",
    color: "var(--route-2)",
    voiceLabel: "remera",
    gestureLabel: "one_tap",
    gestureHint: "Tap once",
  },
  {
    code: "KIM",
    name: "Kimironko",
    route: "R3",
    color: "var(--route-3)",
    voiceLabel: "kimironko",
    gestureLabel: "hold",
    gestureHint: "Hold your hand still",
  },
  {
    code: "DTN",
    name: "Downtown",
    route: "R4",
    color: "var(--route-4)",
    voiceLabel: "downtown",
    gestureLabel: "two_taps",
    gestureHint: "Tap twice",
  },
] as const satisfies readonly Destination[];

/** Model labels that never select a stop. */
export const NON_SELECTING_VOICE_LABELS = ["noise", "unknown"] as const;
export const NON_SELECTING_GESTURE_LABELS = ["passing", "idle"] as const;

export type DestinationCode = (typeof DESTINATIONS)[number]["code"];

const BY_CODE = new Map<string, Destination>(DESTINATIONS.map((d) => [d.code, d]));

export function isDestinationCode(value: string): value is DestinationCode {
  return BY_CODE.has(value);
}

export function getDestination(code: string): Destination | undefined {
  return BY_CODE.get(code);
}
