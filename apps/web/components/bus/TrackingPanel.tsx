import clsx from "clsx";
import { Check, Navigation, Square } from "lucide-react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { formatGap, type GeoPermission } from "@/lib/auto-tracking";
import type { Bus } from "@/lib/departures";
import { formatDistance } from "@/lib/geo";
import { formatKigaliTime } from "@/lib/time";
import type { TrackerState } from "@/lib/use-bus-tracker";
import type { WakeLockState } from "@/lib/use-wake-lock";

interface TrackingPanelProps {
  bus: Bus;
  tracker: TrackerState;
  wakeLock: WakeLockState;
  permission: GeoPermission;
  /** The driver pressed Stop during this trip. */
  driverStopped: boolean;
  /** Steps to unblock location on this phone. */
  unblockSteps: string;
  stopName: string;
  onAskPermission: () => void;
  onStart: () => void;
  onStop: () => void;
}

const WAKE_TEXT: Record<WakeLockState, string> = {
  on: "Screen stays on while tracking.",
  off: "Keep the screen on: tracking pauses if the phone locks.",
  unsupported: "This phone can't keep the screen on by itself: turn auto-lock off while driving.",
  failed: "Couldn't keep the screen on (battery saver?): turn auto-lock off while driving.",
};

/**
 * GPS sharing for the driver. It starts by itself when HQ releases the bus and stops on
 * arrival, so the driver only acts when something is wrong.
 */
export function TrackingPanel({
  bus,
  tracker,
  wakeLock,
  permission,
  driverStopped,
  unblockSteps,
  stopName,
  onAskPermission,
  onStart,
  onStop,
}: TrackingPanelProps) {
  const result = tracker.lastResult;
  const denied = permission === "denied";

  return (
    <section
      aria-labelledby="tracking-title"
      className={clsx(
        "rounded-card border bg-surface p-4",
        tracker.sharing ? "border-2 border-accent" : "border-line",
      )}
    >
      <div className="flex items-center gap-3" aria-live="polite">
        <span
          aria-hidden
          className={clsx(
            "h-4 w-4 shrink-0 rounded-full",
            tracker.sharing ? "animate-pulse bg-accent" : "border-2 border-muted",
          )}
        />
        <h2 id="tracking-title" className="text-[26px] leading-tight">
          {tracker.sharing ? "Tracking on" : driverStopped ? "Tracking paused" : "Tracking off"}
        </h2>
      </div>
      <p className="mt-1 text-muted">{headline(bus, tracker.sharing, driverStopped, denied || tracker.error !== null, stopName)}</p>

      {denied || tracker.error ? (
        <Banner tone="danger" title="Location is blocked" className="mt-4">
          {tracker.error && !denied ? `${tracker.error} ` : ""}
          {unblockSteps}
        </Banner>
      ) : null}
      {tracker.warning && !tracker.error ? <Banner tone="warn" title={tracker.warning} className="mt-4" /> : null}
      {tracker.hiddenGapMs !== null ? (
        <Banner tone="warn" title={`Tracking paused for ${formatGap(tracker.hiddenGapMs)}`} className="mt-4">
          The phone stops sharing location while this page is hidden or the screen is off. Keep it open on
          screen while driving.
        </Banner>
      ) : null}

      <div className="mt-4">
        {tracker.sharing ? (
          <Button
            variant="secondary"
            size="xl"
            className="w-full"
            onClick={onStop}
            icon={<Square aria-hidden className="h-5 w-5" />}
          >
            Stop tracking
          </Button>
        ) : bus.status === "on_the_way" ? (
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={onStart}
            icon={<Navigation aria-hidden className="h-6 w-6" />}
          >
            {driverStopped ? "Resume tracking" : "Start tracking"}
          </Button>
        ) : bus.status === "at_terminal" && (permission === "prompt" || permission === "unknown") ? (
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={onAskPermission}
            icon={<Navigation aria-hidden className="h-6 w-6" />}
          >
            Allow location now
          </Button>
        ) : bus.status === "at_terminal" && permission === "granted" ? (
          <p className="flex items-center gap-2 font-semibold text-accent">
            <Check aria-hidden className="h-5 w-5" />
            Location allowed · ready
          </p>
        ) : null}
      </div>

      {tracker.sharing ? <p className="mt-3 text-sm text-muted">{WAKE_TEXT[wakeLock]}</p> : null}

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
    </section>
  );
}

function headline(bus: Bus, sharing: boolean, driverStopped: boolean, blocked: boolean, stopName: string): string {
  if (sharing) {
    return bus.status === "on_the_way"
      ? "Sending your location every 5 seconds. Arrival is automatic near the stop."
      : "Sending your location. Distance and ETA start once HQ releases this bus.";
  }
  if (bus.status === "on_the_way") {
    return driverStopped || blocked
      ? "Passengers can't see where the bus is. Resume when you can."
      : "Starting location sharing…";
  }
  if (bus.status === "arrived") return `Stopped automatically: arrived at ${stopName}.`;
  return `Starts by itself when HQ releases ${bus.id}. Keep this page open.`;
}
