import { describe, expect, it } from "vitest";
import { autoTrackingAction, formatGap, unblockLocationSteps } from "@/lib/auto-tracking";

const base = { status: "at_terminal", sharing: false, driverStopped: false, blocked: false };

describe("autoTrackingAction", () => {
  it("starts when HQ releases the bus", () => {
    expect(autoTrackingAction({ ...base, status: "on_the_way" })).toBe("start");
  });

  it("does nothing more once sharing", () => {
    expect(autoTrackingAction({ ...base, status: "on_the_way", sharing: true })).toBe("none");
  });

  it("respects the driver's Stop until the next release, and a blocked location", () => {
    expect(autoTrackingAction({ ...base, status: "on_the_way", driverStopped: true })).toBe("none");
    expect(autoTrackingAction({ ...base, status: "on_the_way", blocked: true })).toBe("none");
  });

  it("stops on arrival", () => {
    expect(autoTrackingAction({ ...base, status: "arrived", sharing: true })).toBe("stop");
    expect(autoTrackingAction({ ...base, status: "arrived" })).toBe("none");
  });

  it("leaves the terminal and loading states to the driver", () => {
    expect(autoTrackingAction({ ...base, sharing: true })).toBe("none");
    expect(autoTrackingAction({ ...base })).toBe("none");
    expect(autoTrackingAction({ ...base, status: null })).toBe("none");
  });
});

describe("driver help", () => {
  it("gives phone-specific steps to unblock location", () => {
    expect(unblockLocationSteps("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toMatch(/^iPhone: Settings/);
    expect(unblockLocationSteps("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toMatch(/^Android:/);
    expect(unblockLocationSteps("")).toMatch(/site settings/);
  });

  it("formats background gaps", () => {
    expect(formatGap(45_000)).toBe("45 s");
    expect(formatGap(150_000)).toBe("3 min");
  });
});
