import { describe, expect, it } from "vitest";
import { etaMinutes, formatEta, haversineMeters } from "@/lib/eta";

const KIOSK = { lat: -1.9441, lng: 30.0619 };

describe("haversineMeters", () => {
  it("is zero for the same point", () => {
    expect(haversineMeters(KIOSK, KIOSK)).toBe(0);
  });

  it("matches the database for a point ~2.4 km east of the kiosk", () => {
    // update_bus_location() returned distance_m = 2400 for this point.
    expect(Math.round(haversineMeters(KIOSK, { lat: -1.9441, lng: 30.0835 }))).toBe(2400);
  });

  it("is symmetric", () => {
    const other = { lat: -1.95, lng: 30.1 };
    expect(haversineMeters(KIOSK, other)).toBeCloseTo(haversineMeters(other, KIOSK), 6);
  });
});

describe("etaMinutes", () => {
  it("rounds up to whole minutes", () => {
    expect(etaMinutes(3000, 18)).toBe(10);
    expect(etaMinutes(3100, 18)).toBe(11);
  });

  it("is never less than 1 minute", () => {
    expect(etaMinutes(10, 18)).toBe(1);
    expect(etaMinutes(0, 18)).toBe(1);
  });

  it("treats speeds below 1 km/h as 1 km/h", () => {
    expect(etaMinutes(1000, 0)).toBe(60);
    expect(etaMinutes(1000, -5)).toBe(60);
  });
});

describe("formatEta", () => {
  it("formats minutes for passengers", () => {
    expect(formatEta(6)).toBe("about 6 min");
    expect(formatEta(0)).toBe("under a minute");
    expect(formatEta(null)).toBe("ETA unknown");
  });
});
