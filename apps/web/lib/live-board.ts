// The public Live board (/live): parses live_board() into the shapes the kiosk and
// dashboard components already use. Pure. Fields are narrowed, not trusted blindly.

import type { Json } from "./database.types";
import type { Bus } from "./departures";
import type { QueueToken } from "./queue";
import type { Route } from "./routes";

export interface LiveBoard {
  stop: { id: string; name: string } | null;
  buses: Bus[];
  /** The kiosk's queue by ticket code. */
  tokens: QueueToken[];
  /** Waiting along each route (the stops it serves). */
  networkWaiting: Record<string, number>;
  routes: Route[];
  updatedAt: string | null;
}

type Obj = { [key: string]: Json | undefined };

const obj = (v: Json | undefined): Obj | null => (v !== null && typeof v === "object" && !Array.isArray(v) ? v : null);
const arr = (v: Json | undefined): Json[] => (Array.isArray(v) ? v : []);
const str = (o: Obj, k: string): string | null => (typeof o[k] === "string" ? (o[k] as string) : null);
const num = (o: Obj, k: string): number | null => (typeof o[k] === "number" ? (o[k] as number) : null);

function parseBus(v: Json): Bus | null {
  const o = obj(v);
  const id = o && str(o, "id");
  const destination = o && str(o, "destination");
  const status = o && str(o, "status");
  if (!o || !id || !destination || !status) return null;
  return {
    id,
    destination,
    status,
    lat: num(o, "lat"),
    lng: num(o, "lng"),
    location_updated_at: str(o, "location_updated_at"),
    released_at: str(o, "released_at"),
    departed_at: str(o, "departed_at"),
    eta_minutes: num(o, "eta_minutes"),
    seats: num(o, "seats") ?? 0,
    standing: num(o, "standing") ?? 0,
    occupancy: num(o, "occupancy") ?? 0,
    last_stop_id: str(o, "last_stop_id"),
    next_stop_id: str(o, "next_stop_id"),
    stops_remaining: num(o, "stops_remaining"),
    distance_remaining_m: num(o, "distance_remaining_m"),
  };
}

function parseToken(v: Json): QueueToken | null {
  const o = obj(v);
  const id = o && num(o, "id");
  const code = o && str(o, "code");
  const destination = o && str(o, "destination");
  const status = o && str(o, "status");
  const created = o && str(o, "created_at");
  if (!o || id === null || !code || !destination || !status || !created) return null;
  return { id, code, destination, status, bus_id: str(o, "bus_id"), created_at: created };
}

function parseRoute(v: Json): Route | null {
  const o = obj(v);
  const route = o && str(o, "route");
  if (!o || !route) return null;
  const stops = arr(o.stops).flatMap((s) => {
    const so = obj(s);
    const id = so && str(so, "id");
    const name = so && str(so, "name");
    const lat = so && num(so, "lat");
    const lng = so && num(so, "lng");
    if (!so || !id || !name || lat === null || lng === null) return [];
    return [{ id, name, lat, lng, distanceM: num(so, "distance_m") ?? 0 }];
  });
  return { route, stops, terminalRadiusM: num(o, "terminal_radius_m") ?? 150 };
}

export function parseLiveBoard(data: Json | null): LiveBoard {
  const o = obj(data ?? null) ?? {};
  const stop = obj(o.stop);
  const stopId = stop && str(stop, "id");
  const waiting = obj(o.network_waiting) ?? {};
  return {
    stop: stop && stopId ? { id: stopId, name: str(stop, "name") ?? stopId } : null,
    buses: arr(o.buses).flatMap((b) => parseBus(b) ?? []),
    tokens: arr(o.tokens).flatMap((t) => parseToken(t) ?? []),
    networkWaiting: Object.fromEntries(
      Object.entries(waiting).flatMap(([k, n]) => (typeof n === "number" ? [[k, n]] : [])),
    ),
    routes: arr(o.routes).flatMap((r) => parseRoute(r) ?? []),
    updatedAt: str(o, "updated_at"),
  };
}
