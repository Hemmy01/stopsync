import clsx from "clsx";
import { ArrowLeft, Check, ChevronRight, Loader2 } from "lucide-react";
import { RouteBadge } from "@/components/RouteBadge";
import type { Bus } from "@/lib/departures";
import { DESTINATIONS } from "@/lib/destinations";
import { BUS_STATUS_LABEL } from "./labels";

interface BusPickerProps {
  buses: Bus[];
  onPick: (busId: string) => void;
  /** Drivers pick for their shift; admins just pick which bus this phone shows. */
  forShift?: boolean;
  /** Buses another driver has: shown, but can't be picked. */
  taken?: readonly string[];
  /** The bus this driver has now. */
  current?: string | null;
  /** The bus being linked right now. */
  pendingId?: string | null;
  /** Back to the current bus without changing. */
  onKeep?: () => void;
}

/** Pick which bus this phone is in. */
export function BusPicker({ buses, onPick, forShift = false, taken = [], current = null, pendingId = null, onKeep }: BusPickerProps) {
  return (
    <div>
      {onKeep && current ? (
        <button
          type="button"
          onClick={onKeep}
          className="mb-4 inline-flex h-11 items-center gap-2 font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          Keep <span className="num">{current}</span>
        </button>
      ) : null}
      <h1 className="text-[32px] leading-tight">
        {forShift ? "Which bus are you driving this shift?" : "Which bus are you driving?"}
      </h1>
      <p className="mt-1 text-muted">
        {forShift
          ? "Your location is shared for this bus only. Change it any time from this page."
          : "Pick it once; this phone remembers it."}
      </p>
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
                {routeBuses.map((bus) => {
                  const isTaken = taken.includes(bus.id);
                  const isCurrent = bus.id === current;
                  const pending = bus.id === pendingId;
                  return (
                    <li key={bus.id} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onPick(bus.id)}
                        disabled={isTaken || pendingId !== null}
                        aria-busy={pending}
                        className={clsx(
                          "flex min-h-16 w-full items-center gap-4 px-4 text-left transition-colors duration-200 ease-out hover:bg-paper disabled:cursor-not-allowed disabled:hover:bg-transparent",
                          isTaken && "opacity-60",
                        )}
                      >
                        <span className="num text-xl font-bold">{bus.id}</span>
                        <span className="flex-1 text-muted">
                          {isTaken ? "Taken by another driver" : (BUS_STATUS_LABEL[bus.status] ?? bus.status)}
                          {isCurrent ? <span className="font-semibold text-accent"> · your bus</span> : null}
                        </span>
                        {pending ? (
                          <Loader2 aria-hidden className="h-5 w-5 animate-spin text-muted" />
                        ) : isCurrent ? (
                          <Check aria-hidden className="h-5 w-5 text-accent" />
                        ) : isTaken ? null : (
                          <ChevronRight aria-hidden className="h-5 w-5 text-muted" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
