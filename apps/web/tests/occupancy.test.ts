import { describe, expect, it } from "vitest";
import type { Bus } from "@/lib/departures";
import { dispatchPlaces, freeLabel, freePlaces, freeSeats, freeStanding } from "@/lib/occupancy";

function bus(id: string, status: string, occupancy: number, destination = "REM"): Bus {
  return {
    id,
    destination,
    status,
    occupancy,
    seats: 40,
    standing: 30,
    eta_minutes: null,
    lat: null,
    lng: null,
    location_updated_at: null,
    released_at: null,
    departed_at: null,
    last_stop_id: null,
    next_stop_id: null,
    stops_remaining: null,
    distance_remaining_m: null,
  };
}

describe("free places", () => {
  it("fills seats before standing places", () => {
    const b = bus("R2-01", "on_the_way", 22);
    expect(freePlaces(b)).toBe(48);
    expect(freeSeats(b)).toBe(18);
    expect(freeStanding(b)).toBe(30);
    expect(freeLabel(b)).toBe("18 seats + 30 standing free");
  });

  it("counts standing only once seats are gone, and says Full", () => {
    expect(freeLabel(bus("R2-01", "on_the_way", 55))).toBe("15 standing free");
    expect(freeLabel(bus("R2-01", "on_the_way", 39))).toBe("1 seat + 30 standing free");
    expect(freeLabel(bus("R2-01", "on_the_way", 70))).toBe("Full");
    expect(freePlaces(bus("R2-01", "on_the_way", 75))).toBe(0);
  });
});

describe("dispatchPlaces", () => {
  it("sums free places on the way and picks the emptiest bus at the terminal", () => {
    const buses = [bus("R2-01", "on_the_way", 60), bus("R2-02", "at_terminal", 5), bus("R1-01", "at_terminal", 0, "NYA")];
    expect(dispatchPlaces("REM", buses, 70)).toEqual({ onTheWay: 1, onTheWayFree: 10, nextFree: 65 });
  });

  it("falls back to the route capacity when no bus is at the terminal", () => {
    expect(dispatchPlaces("REM", [bus("R2-01", "arrived", 70)], 70)).toEqual({ onTheWay: 0, onTheWayFree: 0, nextFree: 70 });
  });
});
