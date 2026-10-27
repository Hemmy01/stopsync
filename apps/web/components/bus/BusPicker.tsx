import { ChevronRight } from "lucide-react";
import { RouteBadge } from "@/components/RouteBadge";
import type { Bus } from "@/lib/departures";
import { DESTINATIONS } from "@/lib/destinations";
import { BUS_STATUS_LABEL } from "./labels";

/** Step 1: pick which bus this phone is in. */
export function BusPicker({ buses, onPick }: { buses: Bus[]; onPick: (busId: string) => void }) {
  return (
    <div>
      <h1 className="text-[32px] leading-tight">Which bus are you driving?</h1>
      <p className="mt-1 text-muted">Pick it once; this phone remembers it.</p>
      <div className="mt-6 space-y-6">
        {DESTINATIONS.map((d) => {
          const routeBuses = buses.filter((b) => b.destination === d.code);
          if (routeBuses.length === 0) return null;
          return (
            <section key={d.code} aria-label={d.name}>
              <h2 className="mb-2 flex items-center gap-3 text-lg">
                <RouteBadge code={d.code} size="sm" />
                {d.name}
              </h2>
              <ul className="overflow-hidden rounded-card border border-line bg-surface">
                {routeBuses.map((bus) => (
                  <li key={bus.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onPick(bus.id)}
                      className="flex min-h-16 w-full items-center gap-4 px-4 text-left transition-colors duration-200 ease-out hover:bg-paper"
                    >
                      <span className="num text-xl font-bold">{bus.id}</span>
                      <span className="flex-1 text-muted">{BUS_STATUS_LABEL[bus.status] ?? bus.status}</span>
                      <ChevronRight aria-hidden className="h-5 w-5 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
