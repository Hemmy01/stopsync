import { describe, expect, it } from "vitest";
import {
  countByDestination,
  departureLabel,
  departureStatus,
  ticketStatusLine,
  type Bus,
} from "@/lib/departures";
import { parseCreateTokenResult } from "@/lib/rpc";

function bus(id: string, destination: string, status: Bus["status"], eta: number | null = null): Bus {
  return {
    id,
    destination,
    status,
    eta_minutes: eta,
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

describe("departureStatus", () => {
  it("is waiting when every bus is at the terminal", () => {
    expect(departureStatus("KIM", [bus("R3-01", "KIM", "at_terminal")])).toEqual({ kind: "waiting" });
  });

  it("prefers the soonest bus on the way", () => {
    const buses = [bus("R3-01", "KIM", "on_the_way", 9), bus("R3-02", "KIM", "on_the_way", 4)];
    expect(departureStatus("KIM", buses)).toEqual({ kind: "on_the_way", busId: "R3-02", etaMinutes: 4 });
  });

  it("shows boarding when a bus has arrived and none is on the way", () => {
    expect(departureStatus("KIM", [bus("R3-01", "KIM", "arrived")])).toEqual({ kind: "boarding", busId: "R3-01" });
  });

  it("ignores other routes", () => {
    expect(departureStatus("KIM", [bus("R1-01", "NYA", "on_the_way", 3)])).toEqual({ kind: "waiting" });
  });
});

describe("labels", () => {
  it("formats the departure strip", () => {
    expect(departureLabel({ kind: "waiting" })).toBe("Waiting for dispatch");
    expect(departureLabel({ kind: "on_the_way", busId: "R3-07", etaMinutes: 6 })).toBe("R3-07 · 6 min");
    expect(departureLabel({ kind: "boarding", busId: "R3-07" })).toBe("Boarding");
  });

  it("formats the ticket status line", () => {
    expect(ticketStatusLine({ kind: "waiting" })).toBe("Waiting for dispatch");
    expect(ticketStatusLine({ kind: "on_the_way", busId: "R3-07", etaMinutes: 6 })).toBe(
      "Bus R3-07 is on the way · about 6 min",
    );
    expect(ticketStatusLine({ kind: "boarding", busId: "R3-07" })).toBe("Your bus is here");
  });
});

describe("countByDestination", () => {
  it("counts rows per destination", () => {
    expect(countByDestination([{ destination: "KIM" }, { destination: "NYA" }, { destination: "KIM" }])).toEqual({
      KIM: 2,
      NYA: 1,
    });
  });
});

describe("parseCreateTokenResult", () => {
  it("parses created and duplicate results", () => {
    expect(parseCreateTokenResult({ status: "created", code: "R3-001", destination: "KIM", position: 1 })).toEqual({
      status: "created",
      code: "R3-001",
      destination: "KIM",
      position: 1,
    });
    expect(parseCreateTokenResult({ status: "duplicate", code: "R3-001", destination: "KIM" })).toEqual({
      status: "duplicate",
      code: "R3-001",
      destination: "KIM",
    });
  });

  it("turns anything unexpected into an error", () => {
    expect(parseCreateTokenResult({ status: "error", message: "Unknown destination" })).toEqual({
      status: "error",
      message: "Unknown destination",
    });
    expect(parseCreateTokenResult(null).status).toBe("error");
    expect(parseCreateTokenResult([1, 2]).status).toBe("error");
  });
});
