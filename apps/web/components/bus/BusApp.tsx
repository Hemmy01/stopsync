"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Banner } from "@/components/Banner";
import { KigaliClock } from "@/components/KigaliClock";
import { HomeLink } from "@/components/HomeLink";
import { autoTrackingAction, unblockLocationSteps } from "@/lib/auto-tracking";
import { adjustOccupancy, chooseMyBus, completeTrip, loadTakenBuses, markBusArrived } from "@/lib/rpc";
import { refreshAccount, useAccount } from "@/lib/use-account";
import { getSupabase, STOP_ID, type StopSyncClient } from "@/lib/supabase";
import { useActions } from "@/lib/use-actions";
import { useBusTracker } from "@/lib/use-bus-tracker";
import { useGeoPermission } from "@/lib/use-geo-permission";
import { unwrap, useRealtimeData, type RealtimeTable } from "@/lib/use-realtime-data";
import { useStopName } from "@/lib/use-stop";
import { useWakeLock } from "@/lib/use-wake-lock";
import { BusConsole } from "./BusConsole";
import { AccountBadge } from "@/components/auth/AccountBadge";
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
  const account = useAccount();
  // A driver drives the bus linked to their account (chosen per shift); admins pick any.
  const isDriver = account.role === "driver";
  const ownBus = isDriver ? account.busId : null;
  const [choosing, setChoosing] = useState(false);
  const [taken, setTaken] = useState<string[]>([]);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const { data: buses, loading, error } = useRealtimeData(TABLES, loadBuses);
  const [pickedId, setBusId] = useState<string | null>(null);
  const busId = ownBus ?? pickedId;
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

  const showDriverPicker = isDriver && (!ownBus || choosing);

  // Which buses other drivers hold, refreshed whenever the picker opens.
  useEffect(() => {
    if (!showDriverPicker) return;
    let live = true;
    loadTakenBuses(getSupabase())
      .then((ids) => live && setTaken(ids))
      .catch(() => live && setTaken([]));
    return () => {
      live = false;
    };
  }, [showDriverPicker]);

  const bus = showDriverPicker ? null : (buses?.find((b) => b.id === busId) ?? null);
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

  /** Stop sharing for the old bus, then link the account to the new one. */
  const chooseShiftBus = async (id: string) => {
    if (id === ownBus) {
      setChoosing(false);
      return;
    }
    setChooseError(null);
    setChoosingId(id);
    tracker.stop();
    tracker.reset();
    setStoppedTrip(null);
    setArrivalMessage(null);
    const result = await chooseMyBus(getSupabase(), id);
    if (result.ok) {
      await refreshAccount();
      setChoosing(false);
    } else {
      setChooseError(result.message);
      void loadTakenBuses(getSupabase()).then(setTaken, () => {});
    }
    setChoosingId(null);
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

  const backAtTerminal = async () => {
    if (!bus) return;
    setArrivalMessage(null);
    const result = await run(`complete-${bus.id}`, () => completeTrip(getSupabase(), bus.id, "manual"));
    if (result?.ok) {
      const off = result.data.completed_count;
      setArrivalMessage(typeof off === "number" ? `Trip ended · ${off} got off` : "Trip ended");
    }
  };

  const adjust = (delta: 1 | -1) => {
    if (!bus) return;
    void run(`occupancy-${bus.id}`, () => adjustOccupancy(getSupabase(), bus.id, delta));
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10">
      <header className="flex h-16 items-center justify-between border-b border-line">
        <HomeLink />
        <div className="flex items-center gap-4">
          <KigaliClock className="text-xl font-medium" />
          <AccountBadge compact />
        </div>
      </header>

      <main className="flex-1 pt-6">
        {error ? (
          <Banner tone="danger" title="Can't reach Tap&Select" className="mb-4">
            {error}
          </Banner>
        ) : null}

        {loading && !buses ? <p className="text-muted">Loading buses…</p> : null}

        {buses && !bus && !isDriver ? <BusPicker buses={buses} onPick={pick} /> : null}

        {buses && showDriverPicker ? (
          <>
            {chooseError ? (
              <Banner tone="danger" title="Couldn't pick that bus" className="mb-4">
                {chooseError}
              </Banner>
            ) : null}
            <BusPicker
              buses={buses}
              forShift
              taken={taken}
              current={ownBus}
              pendingId={choosingId}
              onPick={(id) => void chooseShiftBus(id)}
              onKeep={() => {
                setChooseError(null);
                setChoosing(false);
              }}
            />
          </>
        ) : null}

        {bus ? (
          <>
            {isDriver ? (
              <button
                type="button"
                onClick={() => setChoosing(true)}
                className="mb-4 inline-flex h-11 items-center gap-2 font-semibold text-muted hover:text-ink"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" />
                Change bus
              </button>
            ) : (
              <button
                type="button"
                onClick={() => pick(null)}
                className="mb-4 inline-flex h-11 items-center gap-2 font-semibold text-muted hover:text-ink"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" />
                Change bus
              </button>
            )}
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
              occupancy={{
                onAdjust: adjust,
                pending: isPending(`occupancy-${bus.id}`),
                error: errors[`occupancy-${bus.id}`],
              }}
              onArrived={() => void arrive()}
              arriving={isPending(`arrive-${bus.id}`)}
              onBackAtTerminal={() => void backAtTerminal()}
              completing={isPending(`complete-${bus.id}`)}
              arrivalMessage={arrivalMessage}
              arrivalError={errors[`arrive-${bus.id}`] ?? errors[`complete-${bus.id}`]}
              stopName={stopName}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
