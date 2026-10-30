"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useState } from "react";
import { RouteBadge } from "@/components/RouteBadge";
import type { Bus } from "@/lib/departures";
import { getDestination } from "@/lib/destinations";
import { freeLabel, totalPlaces } from "@/lib/occupancy";
import { busProgress, routeFor, type Route } from "@/lib/routes";
import { formatKigaliTime, minutesSince } from "@/lib/time";

// Leaflet needs `window`: render the map in the browser only.
const NetworkMap = dynamic(() => import("./NetworkMap").then((m) => m.NetworkMap), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-card border border-line bg-paper" aria-hidden />,
});

const STATUS: Record<string, string> = {
  at_terminal: "At terminal",
  on_the_way: "On the way",
  arrived: "Arrived · boarding",
};

interface LiveMapProps {
  routes: readonly Route[];
  buses: readonly Bus[];
  now: Date;
}

/** Live map of every route with a details panel for the selected bus. */
export function LiveMap({ routes, buses, now }: LiveMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tracked = buses.filter((b) => b.lat !== null && b.lng !== null);
  const selected = buses.find((b) => b.id === selectedId) ?? null;

  return (
    <section className="rounded-card border border-line bg-surface p-5" aria-labelledby="map-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="map-title" className="text-lg">
          Live map
        </h2>
        <p className="text-sm text-muted">
          <span className="num font-semibold text-ink">{tracked.length}</span> of {buses.length} buses sharing GPS
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <NetworkMap routes={routes} buses={buses} selectedBusId={selectedId} onSelectBus={setSelectedId} />

        <div className="flex flex-col gap-4">
          {tracked.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Buses on the map">
              {tracked.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    aria-pressed={b.id === selectedId}
                    className={clsx(
                      "num h-10 rounded-pill border px-3 text-sm font-semibold transition-colors duration-150 ease-out",
                      b.id === selectedId ? "border-ink bg-ink text-paper" : "border-line hover:border-ink",
                    )}
                  >
                    {b.id}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              No bus is sharing its location. Open <span className="font-semibold text-ink">/bus</span> on a phone
              and start sharing.
            </p>
          )}

          {selected ? (
            <BusDetails bus={selected} route={routeFor(routes, getDestination(selected.destination)?.route)} now={now} />
          ) : tracked.length > 0 ? (
            <p className="text-sm text-muted">Select a bus on the map or above for details.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function BusDetails({ bus, route, now }: { bus: Bus; route: Route | undefined; now: Date }) {
  const dest = getDestination(bus.destination);
  const p = busProgress(bus, route);
  const ago = bus.location_updated_at ? minutesSince(bus.location_updated_at, now) : null;
  const rows: [string, string][] = [
    ["Status", STATUS[bus.status] ?? bus.status],
    ["Last stop", p.lastStopName ?? "—"],
    ["Next stop", p.nextStopName ?? (bus.status === "on_the_way" && bus.stops_remaining === null ? "Off route" : "—")],
    ["Stops left", p.stopsRemaining === null ? "—" : String(p.stopsRemaining)],
    [
      "Distance left",
      bus.distance_remaining_m === null ? "—" : `${(bus.distance_remaining_m / 1000).toFixed(1)} km`,
    ],
    ["ETA", bus.eta_minutes === null ? "—" : `${bus.eta_minutes} min`],
    ["On board", `${bus.occupancy} / ${totalPlaces(bus)}`],
    ["Free", freeLabel(bus).replace(/ free$/, "")],
    ["Left terminal", bus.departed_at ? formatKigaliTime(new Date(bus.departed_at)) : "—"],
    [
      "Last GPS",
      bus.location_updated_at
        ? `${formatKigaliTime(new Date(bus.location_updated_at), true)}${ago !== null && ago >= 1 ? ` · ${ago} min ago` : ""}`
        : "—",
    ],
  ];

  return (
    <article className="rounded-card border border-line p-4" aria-live="polite">
      <div className="flex items-center gap-3">
        <RouteBadge code={bus.destination} size="sm" />
        <div>
          <p className="num text-lg font-bold leading-tight">{bus.id}</p>
          <p className="text-sm text-muted">To {dest?.name ?? bus.destination}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="num text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
