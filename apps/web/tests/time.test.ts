import { describe, expect, it } from "vitest";
import { formatKigaliTime, kigaliDayStartISO, minutesSince } from "@/lib/time";

describe("formatKigaliTime", () => {
  it("shows 24-hour Kigali time (UTC+2)", () => {
    expect(formatKigaliTime(new Date("2026-10-27T16:05:09Z"))).toBe("18:05");
    expect(formatKigaliTime(new Date("2026-10-27T16:05:09Z"), true)).toBe("18:05:09");
  });

  it("wraps past midnight", () => {
    expect(formatKigaliTime(new Date("2026-10-27T22:30:00Z"))).toBe("00:30");
  });
});

describe("minutesSince", () => {
  const now = new Date("2026-10-27T16:20:00Z");

  it("counts whole minutes", () => {
    expect(minutesSince("2026-10-27T16:04:30Z", now)).toBe(15);
  });

  it("never goes negative", () => {
    expect(minutesSince("2026-10-27T16:25:00Z", now)).toBe(0);
  });
});

describe("kigaliDayStartISO", () => {
  it("returns Kigali midnight in UTC", () => {
    expect(kigaliDayStartISO(new Date("2026-10-27T16:00:00Z"))).toBe("2026-10-26T22:00:00.000Z");
  });

  it("rolls over at Kigali midnight, not UTC midnight", () => {
    // 23:30 UTC on the 27th is already 01:30 on the 28th in Kigali.
    expect(kigaliDayStartISO(new Date("2026-10-27T23:30:00Z"))).toBe("2026-10-27T22:00:00.000Z");
  });
});
