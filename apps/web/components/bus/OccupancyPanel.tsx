import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/Button";
import { OccupancyBar } from "@/components/OccupancyBar";
import type { Bus } from "@/lib/departures";
import { freePlaces, totalPlaces } from "@/lib/occupancy";

interface OccupancyPanelProps {
  bus: Bus;
  onAdjust: (delta: 1 | -1) => void;
  pending: boolean;
  error: string | undefined;
}

/** On board count with big − / + so the driver can correct it (each tap is logged). */
export function OccupancyPanel({ bus, onAdjust, pending, error }: OccupancyPanelProps) {
  return (
    <section aria-labelledby="occupancy-title" className="rounded-card border border-line bg-surface p-4">
      <h2 id="occupancy-title" className="text-lg">
        On board
      </h2>
      <div className="mt-3 flex items-center gap-3">
        <Button
          size="xl"
          className="w-20 shrink-0 px-0!"
          onClick={() => onAdjust(-1)}
          disabled={pending || bus.occupancy === 0}
          aria-label="One fewer on board"
          icon={<Minus aria-hidden className="h-8 w-8" strokeWidth={2.5} />}
        />
        <p className="flex-1 text-center" aria-live="polite">
          <span className="num block text-[48px] font-bold leading-none">{bus.occupancy}</span>
          <span className="text-sm text-muted">
            of <span className="num">{totalPlaces(bus)}</span> places
          </span>
        </p>
        <Button
          size="xl"
          className="w-20 shrink-0 px-0!"
          onClick={() => onAdjust(1)}
          disabled={pending || freePlaces(bus) === 0}
          aria-label="One more on board"
          icon={<Plus aria-hidden className="h-8 w-8" strokeWidth={2.5} />}
        />
      </div>
      <OccupancyBar bus={bus} className="mt-4" />
      <p className="mt-2 text-sm text-muted">Boarding at the stop counts tickets. Correct it if people paid cash.</p>
      {error ? (
        <p role="alert" className="mt-2 font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
