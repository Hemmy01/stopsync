import { describe, expect, it } from "vitest";
import { formatKigaliTime, minutesSince } from "@/lib/time";

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
