import { describe, expect, it } from "vitest";
import { formatDistance, geoProblem, msUntilNextSend } from "@/lib/geo";

describe("msUntilNextSend", () => {
  it("sends the first fix immediately", () => {
    expect(msUntilNextSend(null, 1_000)).toBe(0);
  });

  it("waits until 5 s after the last send", () => {
    expect(msUntilNextSend(10_000, 12_000)).toBe(3_000);
    expect(msUntilNextSend(10_000, 15_000)).toBe(0);
    expect(msUntilNextSend(10_000, 20_000)).toBe(0);
  });
});

describe("geoProblem", () => {
  it("treats a denied permission as fatal and mentions HTTPS", () => {
    const p = geoProblem(1);
    expect(p.fatal).toBe(true);
    expect(p.message).toMatch(/HTTPS/);
  });

  it("keeps trying when the fix is unavailable or slow", () => {
    expect(geoProblem(2).fatal).toBe(false);
    expect(geoProblem(3).fatal).toBe(false);
  });
});

describe("formatDistance", () => {
  it("uses metres below 1 km", () => {
    expect(formatDistance(349.6)).toBe("350 m");
    expect(formatDistance(2400)).toBe("2.4 km");
  });
});
