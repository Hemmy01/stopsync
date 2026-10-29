import { describe, expect, it } from "vitest";
import { gestureHintFor, getDestination } from "@/lib/destinations";
import { describeGestureEvent } from "@/lib/gesture-feedback";

describe("describeGestureEvent", () => {
  it("maps each swipe to its stop and arrow", () => {
    expect(describeGestureEvent({ event: "swipe_left", details: {} })).toEqual({ text: "Swipe left", direction: "left", code: "REM" });
    expect(describeGestureEvent({ event: "swipe_right", details: {} })).toEqual({ text: "Swipe right", direction: "right", code: "DTN" });
    expect(describeGestureEvent({ event: "swipe_up", details: {} })).toEqual({ text: "Swipe up", direction: "up", code: "NYA" });
    expect(describeGestureEvent({ event: "swipe_down", details: {} })).toEqual({ text: "Swipe down", direction: "down", code: "KIM" });
  });

  it("describes tap-rule events", () => {
    expect(describeGestureEvent({ event: "tap", details: { ms: "180", count: "2" } })).toEqual({ text: "Tap 2", direction: null, code: null });
    expect(describeGestureEvent({ event: "two_taps", details: {} })).toEqual({ text: "Tap twice", direction: null, code: "DTN" });
    expect(describeGestureEvent({ event: "slow_press", details: {} }).code).toBeNull();
    expect(describeGestureEvent({ event: "something_new", details: {} }).text).toBe("something new");
  });
});

describe("gestureHintFor", () => {
  const rem = getDestination("REM")!;
  it("shows swipes unless the board runs a tap build", () => {
    expect(gestureHintFor(rem, "swipe")).toBe("Swipe left");
    expect(gestureHintFor(rem, "off")).toBe("Swipe left");
    expect(gestureHintFor(rem, "rule")).toBe("Tap once");
    expect(gestureHintFor(rem, "model")).toBe("Tap once");
  });
});
