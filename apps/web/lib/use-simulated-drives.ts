"use client";

import { useSyncExternalStore } from "react";
import type { LatLng } from "./eta";
import { simulateBusPosition } from "./rpc";
import { DRIVE_STEP_MS, drivePath } from "./simulate-drive";
import { getSupabase } from "./supabase";

/** A copy of the record without one key. */
function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

export interface DriveProgress {
  step: number;
  steps: number;
}

interface DrivesState {
  progress: Readonly<Record<string, DriveProgress>>;
  errors: Readonly<Record<string, string>>;
}

// Drives live in this module, not in the dashboard component: Next keeps visited pages alive
// but pauses their effects, so a component-owned timer froze the bus as soon as the presenter
// switched to the kiosk. Now a drive keeps going across pages until it arrives, is stopped,
// or the tab is closed or reloaded (the bus then stays where it last was).
const EMPTY: DrivesState = { progress: {}, errors: {} };
let state: DrivesState = EMPTY;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function update(change: (s: DrivesState) => DrivesState) {
  state = change(state);
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function stopDrive(busId: string) {
  clearTimeout(timers.get(busId));
  timers.delete(busId);
  update((s) => ({ ...s, progress: without(s.progress, busId) }));
}

/** One step every DRIVE_STEP_MS until the kiosk, a refused step (e.g. the bus already arrived) or Stop. */
export function startDrive(busId: string, stops: readonly LatLng[]) {
  const path = drivePath(stops);
  if (path.length === 0 || timers.has(busId)) return;
  update((s) => ({ ...s, errors: without(s.errors, busId) }));

  const tick = async (i: number) => {
    update((s) => ({ ...s, progress: { ...s.progress, [busId]: { step: i + 1, steps: path.length } } }));
    const result = await simulateBusPosition(getSupabase(), busId, path[i]);
    if (!timers.has(busId)) return; // stopped meanwhile
    if (!result.ok) {
      update((s) => ({ ...s, errors: { ...s.errors, [busId]: result.message } }));
      stopDrive(busId);
      return;
    }
    if (result.data.status === "arrived" || i + 1 >= path.length) {
      stopDrive(busId);
      return;
    }
    timers.set(busId, setTimeout(() => void tick(i + 1), DRIVE_STEP_MS));
  };
  timers.set(busId, setTimeout(() => void tick(0), 0));
}

/** Simulated drives running in this tab, and controls for them. */
export function useSimulatedDrives() {
  const { progress, errors } = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  return { progress, errors, start: startDrive, stop: stopDrive };
}
