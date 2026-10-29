// HQ dashboard calculations. Pure: everything is derived from database rows.

import type { Tables } from "./database.types";
import type { Bus } from "./departures";
import { getDestination } from "./destinations";
import { minutesSince } from "./time";

export type Token = Tables<"queue_tokens">;
export type Decision = Tables<"dispatch_decisions">;
export type BusEvent = Tables<"bus_events">;
export type ConfigRow = Tables<"config">;

export interface DestinationSummary {
  waiting: number;
  oldestWaitMin: number | null;
  loadPct: number;
  highLoad: boolean;
}

export function summarizeDestination(
  code: string,
  tokens: readonly Token[],
  capacity: number,
  releaseLoadPct: number,
  now: Date | null,
): DestinationSummary {
  const waiting = tokens.filter((t) => t.destination === code && t.status === "waiting");
  const oldest = waiting.reduce<string | null>(
    (min, t) => (min === null || t.created_at < min ? t.created_at : min),
    null,
  );
  const loadPct = capacity > 0 ? Math.round((waiting.length / capacity) * 100) : 0;
  return {
    waiting: waiting.length,
    oldestWaitMin: oldest === null || now === null ? null : minutesSince(oldest, now),
    loadPct,
    highLoad: waiting.length > 0 && loadPct >= releaseLoadPct,
  };
}

export interface Totals {
  waiting: number;
  boardedToday: number;
  onTheWay: number;
}

export function computeTotals(tokens: readonly Token[], buses: readonly Bus[], dayStartISO: string): Totals {
  const dayStart = new Date(dayStartISO).getTime();
  return {
    waiting: tokens.filter((t) => t.status === "waiting").length,
    boardedToday: tokens.filter(
      (t) => t.status === "boarded" && t.boarded_at !== null && new Date(t.boarded_at).getTime() >= dayStart,
    ).length,
    onTheWay: buses.filter((b) => b.status === "on_the_way").length,
  };
}

// RFID is simulated and only identifies the card, so it is not a way to choose a stop.
export const METHODS = ["voice", "gesture", "manual"] as const;
export type Method = (typeof METHODS)[number];

export interface MethodShare {
  method: Method;
  count: number;
  pct: number;
}

/** How passengers chose their stop, for tokens created today. */
export function methodBreakdown(tokens: readonly Token[], dayStartISO: string): { total: number; shares: MethodShare[] } {
  const dayStart = new Date(dayStartISO).getTime();
  // Only real choices: simulator tickets are stored as "rfid" and left out.
  const today = tokens.filter(
    (t) => new Date(t.created_at).getTime() >= dayStart && (METHODS as readonly string[]).includes(t.method),
  );
  const total = today.length;
  const shares = METHODS.map((method) => {
    const count = today.filter((t) => t.method === method).length;
    return { method, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
  return { total, shares };
}

/** Latest pending decision per destination. */
export function pendingByDestination(decisions: readonly Decision[]): Record<string, Decision> {
  const result: Record<string, Decision> = {};
  for (const d of decisions) {
    if (d.status !== "pending") continue;
    const current = result[d.destination];
    if (!current || d.id > current.id) result[d.destination] = d;
  }
  return result;
}

export type ActivityKind = "token" | "recommendation" | "approved" | "dismissed" | "released" | "departed" | "arrived" | "reset";

export interface ActivityItem {
  key: string;
  at: string;
  kind: ActivityKind;
  destination: string | null;
  text: string;
}

const destName = (code: string) => getDestination(code)?.name ?? code;

const METHOD_TEXT: Record<string, string> = {
  voice: "voice",
  gesture: "gesture",
  rfid: "card",
  manual: "tap on screen",
};

/** Newest-first feed of tokens, decisions and bus events. */
export function buildActivity(
  tokens: readonly Token[],
  decisions: readonly Decision[],
  events: readonly BusEvent[],
  buses: readonly Bus[],
  limit = 40,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const t of tokens) {
    const how = METHOD_TEXT[t.method] ?? t.method;
    const conf = t.confidence === null ? "" : ` ${Math.round(Number(t.confidence) * 100)}%`;
    items.push({
      key: `t-${t.id}`,
      at: t.created_at,
      kind: "token",
      destination: t.destination,
      text: `${t.code} joined the queue for ${destName(t.destination)} · ${how}${conf}`,
    });
  }

  for (const d of decisions) {
    const name = destName(d.destination);
    if (d.status !== "superseded") {
      items.push({
        key: `d-${d.id}`,
        at: d.created_at,
        kind: "recommendation",
        destination: d.destination,
        text: d.action === "release" ? `Recommend releasing a bus to ${name} · ${d.reason}` : `Hold ${name} · ${d.reason}`,
      });
    }
    if ((d.status === "approved" || d.status === "dismissed") && d.decided_at) {
      items.push({
        key: `d-${d.id}-${d.status}`,
        at: d.decided_at,
        kind: d.status,
        destination: d.destination,
        text: d.status === "approved" ? `HQ approved a release to ${name}` : `HQ dismissed the recommendation for ${name}`,
      });
    }
  }

  const busDest = new Map(buses.map((b) => [b.id, b.destination]));
  for (const e of events) {
    const destination = busDest.get(e.bus_id) ?? null;
    const via = e.source === "gps" ? "GPS" : e.source === "manual" ? "driver" : "HQ";
    const kind: ActivityKind =
      e.event === "released" || e.event === "departed" || e.event === "arrived" ? e.event : "reset";
    const text =
      kind === "released"
        ? `Bus ${e.bus_id} released${destination ? ` to ${destName(destination)}` : ""}`
        : kind === "departed"
          ? `Bus ${e.bus_id} left its terminal (${via})`
          : kind === "arrived"
          ? `Bus ${e.bus_id} arrived (${via}) · ${e.boarded_count ?? 0} boarded`
            : `Bus ${e.bus_id} back at the terminal`;
    items.push({ key: `e-${e.id}`, at: e.created_at, kind, destination, text });
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}

export const CONFIG_LABELS: Record<string, { label: string; unit: string }> = {
  release_load_pct: { label: "Release at load", unit: "%" },
  max_wait_minutes: { label: "Release after waiting", unit: "min" },
  default_eta_minutes: { label: "Default ETA", unit: "min" },
  avg_bus_speed_kmh: { label: "Average bus speed", unit: "km/h" },
  arrival_radius_m: { label: "Arrival radius", unit: "m" },
  off_route_m: { label: "Off-route after", unit: "m" },
};

export function configValue(rows: readonly ConfigRow[], key: string, fallback: number): number {
  const row = rows.find((r) => r.key === key);
  return row ? Number(row.value) : fallback;
}

export interface InsightRow {
  method: Method;
  selections: number;
  confirmed: number;
  changed: number;
  cancelledOrTimeout: number;
  /** 0–100, null with no selections. */
  confirmationRate: number | null;
  /** 0–1, null when nothing had a confidence (manual taps). */
  avgConfidence: number | null;
}

interface InsightSource {
  method: string | null;
  selections: number | null;
  confirmed: number | null;
  changed: number | null;
  cancelled_or_timeout: number | null;
  confirmation_rate: number | null;
  avg_confidence: number | null;
}

/** One row per method from model_insights_today, zeros for methods not used yet. */
export function insightRows(source: readonly InsightSource[]): InsightRow[] {
  return METHODS.map((method) => {
    const row = source.find((r) => r.method === method);
    const selections = row?.selections ?? 0;
    return {
      method,
      selections,
      confirmed: row?.confirmed ?? 0,
      changed: row?.changed ?? 0,
      cancelledOrTimeout: row?.cancelled_or_timeout ?? 0,
      confirmationRate: selections > 0 ? Number(row?.confirmation_rate ?? 0) : null,
      avgConfidence: row?.avg_confidence == null ? null : Number(row.avg_confidence),
    };
  });
}
