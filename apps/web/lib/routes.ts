// Routes and live progress along them. Pure, except loadRoutes.
// The database does the real work (update_bus_location); this turns its columns
// into what screens show.

import { departureStatus, type Bus } from "./departures";
import { getDestination } from "./destinations";
import { formatEta } from "./eta";
import type { StopSyncClient } from "./supabase";
import { unwrap } from "./use-realtime-data";

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Along the route from the terminal (seq 0). */
  distanceM: number;
}

export interface Route {
  route: string;
  /** Terminal first, the kiosk last. */
  stops: RouteStop[];
  terminalRadiusM: number;
}

export async function loadRoutes(client: StopSyncClient): Promise<Route[]> {
  const [rows, terminals] = await Promise.all([
    client
      .from("routes_stops")
      .select("route, seq, distance_from_terminal_m, stops(id, name, lat, lng)")
      .order("route")
      .order("seq"),
    client.from("terminals").select("route, radius_m"),
  ]);
  const radius = new Map(unwrap(terminals).map((t) => [t.route, t.radius_m]));
  const byRoute = new Map<string, Route>();
  for (const row of unwrap(rows)) {
    const stop = row.stops;
    if (!stop || stop.lat === null || stop.lng === null) continue;
    let route = byRoute.get(row.route);
    if (!route) {
      route = { route: row.route, stops: [], terminalRadiusM: radius.get(row.route) ?? 150 };
      byRoute.set(row.route, route);
    }
    route.stops.push({ id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng, distanceM: row.distance_from_terminal_m });
  }
  return [...byRoute.values()];
}

export interface BusProgress {
  /** Index into route.stops of the last stop passed; null when off the route. */
  lastIndex: number | null;
  /**
   * 0–1 along a strip with the stops evenly spaced (terminal → kiosk), so the bus sits
   * between the right two dots; null when off the route or unknown.
   */
  stripFraction: number | null;
  lastStopName: string | null;
  nextStopName: string | null;
  stopsRemaining: number | null;
  etaMinutes: number | null;
}

export function busProgress(bus: Bus, route: Route | undefined): BusProgress {
  const stops = route?.stops ?? [];
  const total = stops.at(-1)?.distanceM ?? 0;
  const lastIndex = bus.last_stop_id ? stops.findIndex((s) => s.id === bus.last_stop_id) : -1;
  const onRoute = total > 0 && bus.distance_remaining_m !== null && bus.stops_remaining !== null;
  const stripFraction = onRoute ? evenStripFraction(stops, total - (bus.distance_remaining_m ?? 0)) : null;
  return {
    lastIndex: lastIndex >= 0 ? lastIndex : null,
    stripFraction,
    lastStopName: lastIndex >= 0 ? stops[lastIndex].name : null,
    nextStopName: stops.find((s) => s.id === bus.next_stop_id)?.name ?? null,
    stopsRemaining: bus.stops_remaining,
    etaMinutes: bus.eta_minutes,
  };
}

/** Where progressM (from the terminal) falls on a strip of evenly spaced stops, 0–1. */
export function evenStripFraction(stops: readonly RouteStop[], progressM: number): number {
  if (stops.length < 2) return 0;
  const legs = stops.length - 1;
  for (let i = 0; i < legs; i++) {
    const start = stops[i].distanceM;
    const end = stops[i + 1].distanceM;
    if (progressM <= end || i === legs - 1) {
      const within = end > start ? (progressM - start) / (end - start) : 1;
      return Math.min(Math.max((i + Math.min(Math.max(within, 0), 1)) / legs, 0), 1);
    }
  }
  return 1;
}

/** "Bus R2-01 · passed Kiyovu · 1 stop away · about 6 min". */
export function busProgressLine(bus: Bus, progress: BusProgress): string {
  const parts = [`Bus ${bus.id}`];
  if (progress.lastStopName && progress.lastIndex !== null && progress.lastIndex > 0) {
    parts.push(`passed ${progress.lastStopName}`);
  } else if (progress.lastIndex === 0 && bus.departed_at) {
    parts.push(`left ${progress.lastStopName}`);
  } else if (progress.lastIndex === 0) {
    parts.push(`at ${progress.lastStopName}`);
  }
  if (progress.stopsRemaining !== null && progress.stopsRemaining > 0) {
    parts.push(`${progress.stopsRemaining} ${progress.stopsRemaining === 1 ? "stop" : "stops"} away`);
  }
  parts.push(formatEta(progress.etaMinutes));
  return parts.join(" · ");
}

export function routeFor(routes: readonly Route[], route: string | undefined): Route | undefined {
  return routes.find((r) => r.route === route);
}

export interface TrackedBus {
  bus: Bus;
  route: Route;
  progress: BusProgress;
  line: string;
}

/** The bus coming for a ticket's destination, when it is on the way and on its route. */
export function trackBusFor(destination: string, buses: readonly Bus[], routes: readonly Route[]): TrackedBus | null {
  const status = departureStatus(destination, buses);
  if (status.kind !== "on_the_way") return null;
  const bus = buses.find((b) => b.id === status.busId);
  const route = routeFor(routes, getDestination(destination)?.route);
  if (!bus || !route) return null;
  const progress = busProgress(bus, route);
  if (progress.stripFraction === null) return null;  // no GPS yet, or off the route
  return { bus, route, progress, line: busProgressLine(bus, progress) };
}
