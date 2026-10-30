import clsx from "clsx";
import type { Bus } from "@/lib/departures";
import { freeLabel, freePlaces, totalPlaces } from "@/lib/occupancy";

interface OccupancyBarProps {
  bus: Pick<Bus, "id" | "seats" | "standing" | "occupancy">;
  /** Show "22 on board · 18 seats + 30 standing free" under the bar. */
  showLabel?: boolean;
  /** Short label for tight rows: "22 on board · 48 free". */
  compact?: boolean;
  className?: string;
}

/**
 * Who is on board: filled part = occupancy, the tick marks where seats end and standing
 * begins. Turns amber when the bus is full; the label always says it in words too.
 */
export function OccupancyBar({ bus, showLabel = true, compact = false, className }: OccupancyBarProps) {
  const total = Math.max(totalPlaces(bus), 1);
  const pct = Math.min((bus.occupancy / total) * 100, 100);
  const seatsPct = (bus.seats / total) * 100;
  const full = freePlaces(bus) === 0;

  return (
    <div className={className}>
      <div
        className="relative h-2.5 overflow-hidden rounded-pill bg-paper"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={bus.occupancy}
        aria-label={`Bus ${bus.id}: ${bus.occupancy} of ${total} places taken`}
      >
        <div
          className={clsx("h-full rounded-pill transition-[width] duration-200 ease-out", full ? "bg-warn" : "bg-ink")}
          style={{ width: `${pct}%` }}
        />
        {bus.standing > 0 ? (
          <span aria-hidden className="absolute top-0 h-full w-0.5 bg-surface" style={{ left: `${seatsPct}%` }} />
        ) : null}
      </div>
      {showLabel ? (
        <p className="mt-1 text-xs text-muted">
          <span className="num font-semibold text-ink">{bus.occupancy}</span> on board ·{" "}
          {compact ? (full ? "Full" : `${freePlaces(bus)} free`) : freeLabel(bus)}
        </p>
      ) : null}
    </div>
  );
}
