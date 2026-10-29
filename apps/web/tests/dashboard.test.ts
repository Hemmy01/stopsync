import { describe, expect, it } from "vitest";
import {
  buildActivity,
  computeTotals,
  configValue,
  insightRows,
  methodBreakdown,
  pendingByDestination,
  summarizeDestination,
  type BusEvent,
  type Decision,
  type Token,
} from "@/lib/dashboard";
import type { Bus } from "@/lib/departures";

const DAY_START = "2026-10-26T22:00:00.000Z"; // Kigali midnight, 27 Oct
const NOW = new Date("2026-10-27T10:00:00Z");

let nextId = 1;
function token(over: Partial<Token>): Token {
  return {
    id: nextId++,
    code: "R3-001",
    stop_id: "STOP-01",
    destination: "KIM",
    card_id: null,
    method: "voice",
    confidence: 0.9,
    status: "waiting",
    created_at: "2026-10-27T09:50:00Z",
    boarded_at: null,
    ...over,
  };
}

function decision(over: Partial<Decision>): Decision {
  return {
    id: nextId++,
    destination: "KIM",
    action: "release",
    reason: "Load 72% ≥ 70%",
    waiting: 50,
    load_pct: 72,
    oldest_wait_min: 5,
    status: "pending",
    created_at: "2026-10-27T09:55:00Z",
    decided_at: null,
    ...over,
  };
}

const bus = (id: string, destination: string, status: string): Bus => ({
  id,
  destination,
  status,
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
});

describe("summarizeDestination", () => {
  it("counts waiting passengers, oldest wait and load", () => {
    const tokens = [
      token({ created_at: "2026-10-27T09:44:00Z" }),
      token({ created_at: "2026-10-27T09:58:00Z" }),
      token({ status: "boarded" }),
      token({ destination: "NYA" }),
    ];
    expect(summarizeDestination("KIM", tokens, 70, 70, NOW)).toEqual({
      waiting: 2,
      oldestWaitMin: 16,
      loadPct: 3,
      highLoad: false,
    });
  });

  it("flags high load at the release threshold", () => {
    const tokens = Array.from({ length: 7 }, () => token({}));
    expect(summarizeDestination("KIM", tokens, 10, 70, NOW)).toMatchObject({ loadPct: 70, highLoad: true });
  });

  it("handles an empty queue", () => {
    expect(summarizeDestination("KIM", [], 70, 70, NOW)).toEqual({
      waiting: 0,
      oldestWaitMin: null,
      loadPct: 0,
      highLoad: false,
    });
  });
});

describe("computeTotals", () => {
  it("counts waiting, boarded today and buses on the way", () => {
    const tokens = [
      token({}),
      token({ status: "boarded", boarded_at: "2026-10-27T08:00:00Z" }),
      token({ status: "boarded", boarded_at: "2026-10-26T20:00:00Z" }), // yesterday in Kigali
    ];
    const buses = [bus("R3-01", "KIM", "on_the_way"), bus("R3-02", "KIM", "at_terminal")];
    expect(computeTotals(tokens, buses, DAY_START)).toEqual({ waiting: 1, boardedToday: 1, onTheWay: 1 });
  });
});

describe("methodBreakdown", () => {
  it("shares today's tokens by method in a fixed order", () => {
    const tokens = [
      token({ method: "voice" }),
      token({ method: "voice" }),
      token({ method: "gesture" }),
      token({ method: "manual" }),
      token({ method: "voice", created_at: "2026-10-26T21:00:00Z" }), // yesterday
    ];
    const { total, shares } = methodBreakdown(tokens, DAY_START);
    expect(total).toBe(4);
    expect(shares).toEqual([
      { method: "voice", count: 2, pct: 50 },
      { method: "gesture", count: 1, pct: 25 },
      { method: "manual", count: 1, pct: 25 },
    ]);
  });
});

describe("pendingByDestination", () => {
  it("keeps the latest pending decision per destination", () => {
    const older = decision({ id: 10 });
    const newer = decision({ id: 11, action: "hold" });
    const approved = decision({ id: 12, status: "approved" });
    expect(pendingByDestination([older, newer, approved])).toEqual({ KIM: newer });
  });
});

describe("buildActivity", () => {
  it("merges tokens, decisions and bus events newest first", () => {
    const tokens = [token({ id: 1, code: "R3-001", created_at: "2026-10-27T09:00:00Z", confidence: 0.91 })];
    const decisions = [
      decision({ id: 2, created_at: "2026-10-27T09:10:00Z", status: "approved", decided_at: "2026-10-27T09:12:00Z" }),
      decision({ id: 3, created_at: "2026-10-27T09:11:00Z", status: "superseded" }),
    ];
    const events: BusEvent[] = [
      { id: 4, bus_id: "R3-01", stop_id: "STOP-01", event: "arrived", source: "gps", boarded_count: 12, created_at: "2026-10-27T09:30:00Z" },
    ];
    const feed = buildActivity(tokens, decisions, events, [bus("R3-01", "KIM", "arrived")]);
    expect(feed.map((i) => i.text)).toEqual([
      "Bus R3-01 arrived (GPS) · 12 boarded",
      "HQ approved a release to Kimironko",
      "Recommend releasing a bus to Kimironko · Load 72% ≥ 70%",
      "R3-001 joined the queue for Kimironko · voice 91%",
    ]);
  });
});

describe("configValue", () => {
  it("reads a value or falls back", () => {
    const rows = [{ key: "release_load_pct", value: 80, description: null }];
    expect(configValue(rows, "release_load_pct", 70)).toBe(80);
    expect(configValue(rows, "missing", 15)).toBe(15);
  });
});

describe("insightRows", () => {
  it("fills every method and keeps nulls honest", () => {
    const rows = insightRows([
      {
        method: "voice",
        selections: 4,
        confirmed: 3,
        changed: 1,
        cancelled_or_timeout: 0,
        confirmation_rate: 75,
        avg_confidence: 0.884,
      },
    ]);
    expect(rows.map((r) => r.method)).toEqual(["voice", "gesture", "manual"]);
    expect(rows[0]).toMatchObject({ selections: 4, confirmationRate: 75, avgConfidence: 0.884 });
    expect(rows[1]).toMatchObject({ selections: 0, confirmationRate: null, avgConfidence: null });
  });
});

describe("methodBreakdown and simulator tickets", () => {
  it("leaves rfid (simulator) tickets out of the total", () => {
    const dayStart = "2026-10-27T00:00:00.000Z";
    const t = (method: string): Token =>
      ({ id: 1, method, created_at: "2026-10-27T08:00:00.000Z", status: "waiting" }) as unknown as Token;
    const { total, shares } = methodBreakdown([t("voice"), t("rfid"), t("rfid"), t("manual")], dayStart);
    expect(total).toBe(2);
    expect(shares.find((s) => s.method === "voice")?.pct).toBe(50);
  });
});
