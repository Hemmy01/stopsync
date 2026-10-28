import { MapPin, Navigation, Square } from "lucide-react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { RouteBadge } from "@/components/RouteBadge";
import type { Bus } from "@/lib/departures";
import { getDestination } from "@/lib/destinations";
import { formatDistance } from "@/lib/geo";
import { formatKigaliTime } from "@/lib/time";
import type { TrackerState } from "@/lib/use-bus-tracker";
import { BUS_STATUS_LABEL } from "./labels";

interface BusConsoleProps {
  bus: Bus;
  tracker: TrackerState;
  onStart: () => void;
  onStop: () => void;
  onArrived: () => void;
  arriving: boolean;
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

/** The driver's controls for one bus: share GPS, and "I've arrived". */
export function BusConsole({
  bus,
  tracker,
  onStart,
  onStop,
  onArrived,
  arriving,
  arrivalMessage,
  arrivalError,
  stopName,
}: BusConsoleProps) {
  const dest = getDestination(bus.destination);
  const result = tracker.lastResult;

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

      {tracker.error ? (
        <Banner tone="danger" title="Location is off">
          {tracker.error}
        </Banner>
      ) : null}
      {tracker.warning && !tracker.error ? <Banner tone="warn" title={tracker.warning} /> : null}

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-lg">Location sharing</h2>
        {tracker.sharing ? (
          <Button
            variant="ink"
            size="xl"
            className="mt-3 w-full"
            onClick={onStop}
            icon={<Square aria-hidden className="h-5 w-5" />}
          >
            Stop sharing
          </Button>
        ) : (
          <Button
            variant="primary"
            size="xl"
            className="mt-3 w-full"
            onClick={onStart}
            icon={<Navigation aria-hidden className="h-6 w-6" />}
          >
            Start sharing location
          </Button>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted">Last sent</dt>
            <dd className="num text-lg font-semibold">
              {tracker.lastSentAt ? formatKigaliTime(tracker.lastSentAt, true) : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Accuracy</dt>
            <dd className="num text-lg font-semibold">{tracker.accuracyM !== null ? `±${tracker.accuracyM} m` : "–"}</dd>
          </div>
          <div>
            <dt className="text-muted">To {stopName}</dt>
            <dd className="num text-lg font-semibold">
              {result?.distanceM != null ? formatDistance(result.distanceM) : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">ETA</dt>
            <dd className="num text-lg font-semibold">{result?.etaMinutes != null ? `${result.etaMinutes} min` : "–"}</dd>
          </div>
        </dl>
        {bus.status === "at_terminal" ? (
          <p className="mt-3 text-sm text-muted">
            Your position is saved. Distance and ETA start once HQ releases this bus.
          </p>
        ) : null}
        {bus.status === "on_the_way" ? (
          <p className="mt-3 text-sm text-muted">Sends at most every 5 seconds. Arrival is automatic near the stop.</p>
        ) : null}
      </section>

      <section>
        <Button
          variant="secondary"
          size="xl"
          className="w-full border-2 border-ink"
          onClick={onArrived}
          pending={arriving}
          pendingLabel="Marking arrived…"
          disabled={bus.status === "arrived"}
          icon={<MapPin aria-hidden className="h-6 w-6" />}
        >
          {bus.status === "arrived" ? "Arrived" : "I've arrived"}
        </Button>
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
          <p className="mt-2 text-center text-sm text-muted">HQ resets the bus when it heads back to the terminal.</p>
        ) : null}
      </section>
    </div>
  );
}
