import { describe, expect, it } from "vitest";
import type { Bus } from "@/lib/departures";
import { busProgress, busProgressLine, evenStripFraction, trackBusFor, type Route } from "@/lib/routes";

// R2 as seeded: Giporoso → Gishushu → Kigali Heights → Kimihurura → Kiyovu → kiosk.
const R2: Route = {
  route: "R2",
  terminalRadiusM: 150,
  stops: [
    { id: "STOP-03", name: "Giporoso (Remera)", lat: -1.9601, lng: 30.1066, distanceM: 0 },
    { id: "STOP-09", name: "Gishushu", lat: -1.9509, lng: 30.0998, distanceM: 1272 },
    { id: "STOP-05", name: "Kigali Heights", lat: -1.9534, lng: 30.0925, distanceM: 2129 },
    { id: "STOP-10", name: "Kimihurura", lat: -1.9508, lng: 30.0818, distanceM: 3353 },
    { id: "STOP-11", name: "Kiyovu", lat: -1.9478, lng: 30.07, distanceM: 4706 },
    { id: "STOP-01", name: "Kiosk 1 (Demo)", lat: -1.9441, lng: 30.0619, distanceM: 5696 },
  ],
};

function bus(over: Partial<Bus> = {}): Bus {
  return {
    id: "R2-01",
    destination: "REM",
    status: "on_the_way",
    eta_minutes: 6,
    lat: -1.95,
    lng: 30.08,
    location_updated_at: null,
    released_at: null,
    departed_at: "2026-10-29T10:00:00Z",
    last_stop_id: "STOP-10",
    next_stop_id: "STOP-11",
    stops_remaining: 2,
    distance_remaining_m: 2000,
    seats: 40,
    standing: 30,
    occupancy: 0,
    ...over,
  };
}

describe("evenStripFraction", () => {
  it("puts stops at even steps whatever the distance between them", () => {
    expect(evenStripFraction(R2.stops, 0)).toBe(0);
    expect(evenStripFraction(R2.stops, 1272)).toBeCloseTo(1 / 5);
    expect(evenStripFraction(R2.stops, 3353)).toBeCloseTo(3 / 5);
    expect(evenStripFraction(R2.stops, 5696)).toBe(1);
  });

  it("interpolates within a leg and clamps outside the route", () => {
    expect(evenStripFraction(R2.stops, (1272 + 2129) / 2)).toBeCloseTo(1.5 / 5);
    expect(evenStripFraction(R2.stops, -100)).toBe(0);
    expect(evenStripFraction(R2.stops, 9999)).toBe(1);
  });
});

describe("busProgress", () => {
  it("names the last and next stop from the database columns", () => {
    const p = busProgress(bus(), R2);
    expect(p.lastIndex).toBe(3);
    expect(p.lastStopName).toBe("Kimihurura");
    expect(p.nextStopName).toBe("Kiyovu");
    expect(p.stopsRemaining).toBe(2);
    // 3696 m from the terminal: between Kimihurura (3353) and Kiyovu (4706).
    expect(p.stripFraction).toBeGreaterThan(3 / 5);
    expect(p.stripFraction).toBeLessThan(4 / 5);
  });

  it("has no strip position when the bus is off its route", () => {
    const p = busProgress(bus({ last_stop_id: null, next_stop_id: null, stops_remaining: null }), R2);
    expect(p.stripFraction).toBeNull();
    expect(p.lastIndex).toBeNull();
  });
});

describe("busProgressLine", () => {
  it("reads like the kiosk ticket", () => {
    expect(busProgressLine(bus(), busProgress(bus(), R2))).toBe(
      "Bus R2-01 · passed Kimihurura · 2 stops away · about 6 min",
    );
  });

  it("says one stop, and 'left' the terminal once departed", () => {
    const near = bus({ last_stop_id: "STOP-11", next_stop_id: "STOP-01", stops_remaining: 1, eta_minutes: 2 });
    expect(busProgressLine(near, busProgress(near, R2))).toBe("Bus R2-01 · passed Kiyovu · 1 stop away · about 2 min");

    const leaving = bus({ last_stop_id: "STOP-03", next_stop_id: "STOP-09", stops_remaining: 5, eta_minutes: 19 });
    expect(busProgressLine(leaving, busProgress(leaving, R2))).toBe(
      "Bus R2-01 · left Giporoso (Remera) · 5 stops away · about 19 min",
    );
    const waiting = { ...leaving, departed_at: null };
    expect(busProgressLine(waiting, busProgress(waiting, R2))).toContain("at Giporoso (Remera)");
  });
});

describe("trackBusFor", () => {
  it("tracks the bus on the way to the ticket's destination", () => {
    const tracked = trackBusFor("REM", [bus()], [R2]);
    expect(tracked?.bus.id).toBe("R2-01");
    expect(tracked?.line).toContain("passed Kimihurura");
  });

  it("returns null with no GPS progress, no bus on the way, or no route", () => {
    expect(trackBusFor("REM", [bus({ stops_remaining: null, distance_remaining_m: null })], [R2])).toBeNull();
    expect(trackBusFor("REM", [bus({ status: "at_terminal" })], [R2])).toBeNull();
    expect(trackBusFor("REM", [bus()], [])).toBeNull();
  });
});
