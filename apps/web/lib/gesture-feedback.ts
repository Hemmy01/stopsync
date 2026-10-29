// What the kiosk shows for a live "LOG,gesture=<event>" line from the board. Pure.

import { DESTINATIONS, swipeDirection, type DestinationCode, type SwipeDirection } from "./destinations";
import type { GestureLogEvent } from "./protocol";

export interface GestureFeedback {
  /** Short text, e.g. "Swipe left" or "Tap 2". */
  text: string;
  /** Set for swipes, so the kiosk can draw the arrow. */
  direction: SwipeDirection | null;
  /** The stop this event points at, if any. */
  code: DestinationCode | null;
}

export function describeGestureEvent({ event, details }: GestureLogEvent): GestureFeedback {
  const swipe = DESTINATIONS.find((d) => d.gestureLabel === event);
  if (swipe) {
    return { text: swipe.gestureHint, direction: swipeDirection(swipe.gestureLabel), code: swipe.code };
  }
  const tap = DESTINATIONS.find((d) => d.tapLabel === event);
  if (tap) return { text: tap.tapHint, direction: null, code: tap.code };

  switch (event) {
    case "tap":
      return { text: details.count ? `Tap ${details.count}` : "Tap", direction: null, code: null };
    case "slow_press":
      return { text: "Too slow for a tap", direction: null, code: null };
    case "ignored":
      return { text: "Not counted", direction: null, code: null };
    default:
      return { text: event.replace(/_/g, " "), direction: null, code: null };
  }
}
