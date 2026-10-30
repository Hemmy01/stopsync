// Single source for destination display config in the web app.
// The same mapping lives in supabase/seed.sql and firmware/kiosk_node/config.h;
// tests/firmware-config.test.ts checks config.h against this file.

import type { BoardGestureMode } from "./protocol";

export type SwipeDirection = "left" | "right" | "up" | "down";
export type SwipeLabel = `swipe_${SwipeDirection}`;

export interface Destination {
  code: string;
  name: string;
  route: string;
  /** CSS variable holding the route colour. */
  color: string;
  /** Edge Impulse voice model label. */
  voiceLabel: string;
  /** Swipe the board reports (APDS9960 direction engine, GESTURE_SWIPE). */
  gestureLabel: SwipeLabel;
  /** What the passenger does, e.g. "Swipe left". */
  gestureHint: string;
  /** Tap pattern for the older GESTURE_RULE detector and the Edge Impulse tap model. */
  tapLabel: string;
  /** e.g. "Tap once"; shown when the board reports gesture=rule or gesture=model. */
  tapHint: string;
}

export const DESTINATIONS = [
  {
    code: "NYA",
    name: "Nyabugogo",
    route: "R1",
    color: "var(--route-1)",
    voiceLabel: "nyabugogo",
    gestureLabel: "swipe_up",
    gestureHint: "Swipe up",
    tapLabel: "three_taps",
    tapHint: "Tap 3 times",
  },
  {
    code: "REM",
    name: "Remera",
    route: "R2",
    color: "var(--route-2)",
    voiceLabel: "remera",
    gestureLabel: "swipe_left",
    gestureHint: "Swipe left",
    tapLabel: "one_tap",
    tapHint: "Tap once",
  },
  {
    code: "KIM",
    name: "Kimironko",
    route: "R3",
    color: "var(--route-3)",
    voiceLabel: "kimironko",
    gestureLabel: "swipe_down",
    gestureHint: "Swipe down",
    tapLabel: "hold",
    tapHint: "Hold your hand still",
  },
  {
    code: "DTN",
    name: "Downtown",
    route: "R4",
    color: "var(--route-4)",
    voiceLabel: "downtown",
    gestureLabel: "swipe_right",
    gestureHint: "Swipe right",
    tapLabel: "two_taps",
    tapHint: "Tap twice",
  },
] as const satisfies readonly Destination[];

/** Model labels that never select a stop. */
export const NON_SELECTING_VOICE_LABELS = ["noise", "unknown"] as const;
/** Tap model labels that never select a stop. */
export const NON_SELECTING_TAP_LABELS = ["passing", "idle"] as const;

export type DestinationCode = (typeof DESTINATIONS)[number]["code"];

const BY_CODE = new Map<string, Destination>(DESTINATIONS.map((d) => [d.code, d]));

export function isDestinationCode(value: string): value is DestinationCode {
  return BY_CODE.has(value);
}

export function getDestination(code: string): Destination | undefined {
  return BY_CODE.get(code);
}

/** "swipe_left" → "left". */
export function swipeDirection(label: SwipeLabel): SwipeDirection {
  return label.slice("swipe_".length) as SwipeDirection;
}

/** The hint passengers should follow for the board's gesture mode (swipes unless it says taps). */
export function gestureHintFor(d: Destination, mode: BoardGestureMode): string {
  return mode === "rule" || mode === "model" ? d.tapHint : d.gestureHint;
}
