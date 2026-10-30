import clsx from "clsx";
import { RouteBadge } from "@/components/RouteBadge";
import { departureLabel, departureStatus, type Bus } from "@/lib/departures";
import { DESTINATIONS } from "@/lib/destinations";

interface DepartureStripProps {
  buses: readonly Bus[];
  waiting: Readonly<Record<string, number>>;
  loading: boolean;
}

/** Airport-board row: one cell per destination, always visible. */
export function DepartureStrip({ buses, waiting, loading }: DepartureStripProps) {
  return (
    <section aria-label="Live departures" className="shrink-0 border-t-2 border-ink bg-surface">
      <ul className="grid grid-cols-4 divide-x divide-line">
        {DESTINATIONS.map((d) => {
          const status = departureStatus(d.code, buses);
          const count = waiting[d.code] ?? 0;
          const label = departureLabel(status);
          return (
            <li key={d.code} className="flex items-center gap-4 px-6 py-4">
              <RouteBadge code={d.code} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[22px] font-semibold leading-tight">{d.name}</p>
                <p
                  key={label}
                  className={clsx(
                    "animate-tick truncate text-base",
                    status.kind === "waiting" ? "text-muted" : "font-semibold text-ink",
                    status.kind === "on_the_way" && "num",
                  )}
                >
                  {status.kind === "boarding" ? <span className="text-accent">● </span> : null}
                  {label}
                </p>
              </div>
              <div className="text-right">
                <p className="overflow-hidden text-[36px] font-bold leading-none">
                  <span key={count} className="num inline-block animate-tick">
                    {loading ? "–" : count}
                  </span>
                </p>
                <p className="text-sm text-muted">waiting</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
