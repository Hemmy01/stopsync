import { describe, expect, it } from "vitest";
import type { Bus } from "@/lib/departures";
import { boardingNow, findTicket, queuePosition, ticketRange, ticketStatus, type QueueToken } from "@/lib/queue";

let nextId = 1;
const tok = (code: string, over: Partial<QueueToken> = {}): QueueToken => ({
  id: nextId++,
  code,
  destination: "REM",
  status: "waiting",
  bus_id: null,
  created_at: `2026-10-29T10:${String(nextId).padStart(2, "0")}:00Z`,
  ...over,
});

function bus(id: string, status: string, over: Partial<Bus> = {}): Bus {
  return {
    id,
    destination: "REM",
    status,
    seats: 40,
    standing: 30,
    occupancy: 0,
    eta_minutes: 6,
    lat: null,
    lng: null,
    location_updated_at: null,
    released_at: null,
    departed_at: null,
    last_stop_id: null,
    next_stop_id: null,
    stops_remaining: null,
    distance_remaining_m: null,
    ...over,
  };
}

describe("queuePosition", () => {
  it("counts only waiting tickets ahead on the same route", () => {
    const a = tok("R2-001");
    const b = tok("R2-002", { status: "boarded", bus_id: "R2-01" });
    const c = tok("R3-001", { destination: "KIM" });
    const d = tok("R2-003");
    const all = [d, c, b, a];
    expect(queuePosition(all, a)).toBe(1);
    expect(queuePosition(all, d)).toBe(2);
    expect(queuePosition(all, b)).toBeNull();
  });

  it("orders by time, then id", () => {
    const late = tok("R2-009", { created_at: "2026-10-29T09:00:00Z" });
    const early = tok("R2-010", { created_at: "2026-10-29T08:00:00Z" });
    expect(queuePosition([late, early], late)).toBe(2);
  });
});

describe("findTicket", () => {
  it("takes the newest ticket when a code repeats across days", () => {
    const old = tok("R2-001", { created_at: "2026-10-28T10:00:00Z" });
    const today = tok("R2-001", { created_at: "2026-10-29T10:00:00Z" });
    expect(findTicket([today, old], "R2-001")).toBe(today);
  });
});

describe("boardingNow", () => {
  it("lists each bus at the stop with the range of tickets it called", () => {
    const tokens = [
      tok("R2-010", { status: "boarded", bus_id: "R2-01" }),
      tok("R2-011", { status: "boarded", bus_id: "R2-01" }),
      tok("R2-012", { status: "boarded", bus_id: "R2-01" }),
      tok("R2-013"),
    ];
    const result = boardingNow([bus("R2-01", "arrived"), bus("R2-02", "on_the_way")], tokens);
    expect(result).toEqual([{ busId: "R2-01", destination: "REM", count: 3, firstCode: "R2-010", lastCode: "R2-012" }]);
    expect(ticketRange(result[0])).toBe("R2-010–R2-012");
    expect(ticketRange({ firstCode: "R2-010", lastCode: "R2-010" })).toBe("R2-010");
  });

  it("leaves out a bus at the stop that called nobody", () => {
    expect(boardingNow([bus("R2-01", "arrived")], [tok("R2-001")])).toEqual([]);
  });
});

describe("ticketStatus", () => {
  it("says please board once the ticket is called", () => {
    const t = tok("R2-001", { status: "boarded", bus_id: "R2-01" });
    expect(ticketStatus(t, "REM", [bus("R2-01", "arrived")], null)).toEqual({
      kind: "called",
      line: "Your bus is here, please board",
      busId: "R2-01",
    });
  });

  it("tells a passenger the bus at the stop didn't take keeps their place", () => {
    const t = tok("R2-050");
    expect(ticketStatus(t, "REM", [bus("R2-01", "arrived")], 1).line).toBe("Not on R2-01 · you keep your place (No. 1)");
  });

  it("shows the bus on the way, or waiting for dispatch", () => {
    const t = tok("R2-002");
    expect(ticketStatus(t, "REM", [bus("R2-01", "on_the_way")], 2).line).toBe("Bus R2-01 is on the way · about 6 min");
    expect(ticketStatus(t, "REM", [bus("R2-01", "at_terminal")], 2).line).toBe("Waiting for dispatch");
  });

  it("before the ticket row arrives, only says the bus is at the stop", () => {
    expect(ticketStatus(undefined, "REM", [bus("R2-01", "arrived")], null).line).toBe("Bus R2-01 is at the stop");
  });
});
