import type { ComponentProps } from "react";
import { Flag, MapPin } from "lucide-react";
import { Button } from "@/components/Button";
import { RouteBadge } from "@/components/RouteBadge";
import type { Bus } from "@/lib/departures";
import { getDestination } from "@/lib/destinations";
import { BUS_STATUS_LABEL } from "./labels";
import { OccupancyPanel } from "./OccupancyPanel";
import { TrackingPanel } from "./TrackingPanel";

interface BusConsoleProps {
  bus: Bus;
  /** Everything the tracking panel needs besides the bus and stop name. */
  tracking: Omit<ComponentProps<typeof TrackingPanel>, "bus" | "stopName">;
  occupancy: Omit<ComponentProps<typeof OccupancyPanel>, "bus">;
  onArrived: () => void;
  arriving: boolean;
  /** After boarding: the bus is back at its terminal and everyone gets off. */
  onBackAtTerminal: () => void;
  completing: boolean;
  arrivalMessage: string | null;
  arrivalError: string | undefined;
  stopName: string;
}

function StatusLine({ bus }: { bus: Bus }) {
  if (bus.status === "on_the_way") {
    return (
      <p className="text-lg font-semibold text-accent">
        On the way
        {bus.eta_minutes != null ? (
          <>
            {" · ETA "}
            <span className="num">{bus.eta_minutes} min</span>
          </>
        ) : null}
      </p>
    );
  }
  if (bus.status === "arrived") return <p className="text-lg font-semibold">Arrived · boarding</p>;
  return <p className="text-lg text-muted">At terminal · waiting for HQ to release</p>;
}

/** The driver's controls for one bus: automatic GPS tracking, and "I've arrived". */
export function BusConsole({
  bus,
  tracking,
  occupancy,
  onArrived,
  arriving,
  onBackAtTerminal,
  completing,
  arrivalMessage,
  arrivalError,
  stopName,
}: BusConsoleProps) {
  const dest = getDestination(bus.destination);

  return (
    <div className="space-y-5">
      <section className="flex items-center gap-4 rounded-card border border-line bg-surface p-4">
        <RouteBadge code={bus.destination} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="num text-[32px] font-bold leading-none">{bus.id}</p>
          <p className="mt-1 truncate text-muted">to {dest?.name ?? bus.destination}</p>
        </div>
        <span className="sr-only">Status: {BUS_STATUS_LABEL[bus.status]}</span>
      </section>

      <div aria-live="polite">
        <StatusLine bus={bus} />
      </div>

      <TrackingPanel bus={bus} stopName={stopName} {...tracking} />

      <OccupancyPanel bus={bus} {...occupancy} />

      <section>
        {bus.status === "arrived" ? (
          <Button
            variant="secondary"
            size="xl"
            className="w-full border-2 border-ink"
            onClick={onBackAtTerminal}
            pending={completing}
            pendingLabel="Ending trip…"
            icon={<Flag aria-hidden className="h-6 w-6" />}
          >
            Back at terminal
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="xl"
            className="w-full border-2 border-ink"
            onClick={onArrived}
            pending={arriving}
            pendingLabel="Marking arrived…"
            icon={<MapPin aria-hidden className="h-6 w-6" />}
          >
            I&apos;ve arrived
          </Button>
        )}
        {arrivalMessage ? (
          <p role="status" className="mt-2 text-center font-semibold text-accent">
            {arrivalMessage}
          </p>
        ) : null}
        {arrivalError ? (
          <p role="alert" className="mt-2 text-center font-semibold text-danger">
            {arrivalError}
          </p>
        ) : null}
        {bus.status === "arrived" ? (
          <p className="mt-2 text-center text-sm text-muted">
            Riders get off at the terminal. Tap Back at terminal there (or HQ resets the bus).
          </p>
        ) : null}
      </section>
    </div>
  );
}
