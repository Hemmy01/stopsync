"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Banner } from "@/components/Banner";
import { KigaliClock } from "@/components/KigaliClock";
import { Wordmark } from "@/components/Wordmark";
import { autoTrackingAction, unblockLocationSteps } from "@/lib/auto-tracking";
import { markBusArrived } from "@/lib/rpc";
import { getSupabase, STOP_ID, type StopSyncClient } from "@/lib/supabase";
import { useActions } from "@/lib/use-actions";
import { useBusTracker } from "@/lib/use-bus-tracker";
import { useGeoPermission } from "@/lib/use-geo-permission";
import { unwrap, useRealtimeData, type RealtimeTable } from "@/lib/use-realtime-data";
import { useStopName } from "@/lib/use-stop";
import { useWakeLock } from "@/lib/use-wake-lock";
import { BusConsole } from "./BusConsole";
import { BusPicker } from "./BusPicker";

const TABLES: readonly RealtimeTable[] = ["buses"];
const STORAGE_KEY = "stopsync.bus";

async function loadBuses(supabase: StopSyncClient) {
  return unwrap(await supabase.from("buses").select("*").order("id"));
}

function readSavedBus(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveBus(busId: string | null) {
  try {
    if (busId) window.localStorage.setItem(STORAGE_KEY, busId);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
}

export function BusApp() {
  const { data: buses, loading, error } = useRealtimeData(TABLES, loadBuses);
  const [busId, setBusId] = useState<string | null>(null);
  const tracker = useBusTracker(busId);
  const { run, isPending, errors } = useActions();
  const [arrivalMessage, setArrivalMessage] = useState<string | null>(null);
  const stopName = useStopName(STOP_ID);
  const { permission, ask } = useGeoPermission();
  const wakeLock = useWakeLock(tracker.sharing);
  // The trip (released_at) on which the driver pressed Stop; a new release clears it.
  const [stoppedTrip, setStoppedTrip] = useState<string | null>(null);

  useEffect(() => {
    const restore = () => setBusId(readSavedBus());
    restore();
  }, []);

  const bus = buses?.find((b) => b.id === busId) ?? null;
  const status = bus?.status ?? null;
  const trip = bus?.released_at ?? null;
  const driverStopped = trip !== null && stoppedTrip === trip;
  const blocked = permission === "denied" || tracker.error !== null;

  // Start when HQ releases the bus, stop when it arrives at the end of the route.
  const { sharing, start: startTracking, stop: stopTracking } = tracker;
  useEffect(() => {
    const action = autoTrackingAction({ status, sharing, driverStopped, blocked });
    if (action === "start") startTracking();
    if (action === "stop") stopTracking();
  }, [status, sharing, driverStopped, blocked, startTracking, stopTracking]);

  const pick = (id: string | null) => {
    tracker.stop();
    tracker.reset();
    setStoppedTrip(null);
    setArrivalMessage(null);
    setBusId(id);
    saveBus(id);
  };

  const arrive = async () => {
    if (!bus) return;
    setArrivalMessage(null);
    const result = await run(`arrive-${bus.id}`, () => markBusArrived(getSupabase(), bus.id, "manual"));
    if (result?.ok) {
      const boarded = result.data.boarded_count;
      setArrivalMessage(typeof boarded === "number" ? `Marked arrived · ${boarded} boarded` : "Marked arrived");
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10">
      <header className="flex h-16 items-center justify-between border-b border-line">
        <Link href="/" aria-label="Tap&Select home">
          <Wordmark />
        </Link>
        <KigaliClock className="text-xl font-medium" />
      </header>

      <main className="flex-1 pt-6">
        {error ? (
          <Banner tone="danger" title="Can't reach Tap&Select" className="mb-4">
            {error}
          </Banner>
        ) : null}

        {loading && !buses ? <p className="text-muted">Loading buses…</p> : null}

        {buses && !bus ? <BusPicker buses={buses} onPick={pick} /> : null}

        {bus ? (
          <>
            <button
              type="button"
              onClick={() => pick(null)}
              className="mb-4 inline-flex h-11 items-center gap-2 font-semibold text-muted hover:text-ink"
            >
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Change bus
            </button>
            <BusConsole
              bus={bus}
              tracking={{
                tracker,
                wakeLock,
                permission,
                driverStopped,
                unblockSteps: unblockLocationSteps(typeof navigator === "undefined" ? "" : navigator.userAgent),
                onAskPermission: ask,
                onStart: () => {
                  setStoppedTrip(null);
                  tracker.reset();
                  tracker.start();
                },
                onStop: () => {
                  tracker.stop();
                  setStoppedTrip(trip);
                },
              }}
              onArrived={() => void arrive()}
              arriving={isPending(`arrive-${bus.id}`)}
              arrivalMessage={arrivalMessage}
              arrivalError={errors[`arrive-${bus.id}`]}
              stopName={stopName}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
