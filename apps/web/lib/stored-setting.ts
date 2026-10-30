"use client";

import { useSyncExternalStore } from "react";

/**
 * A small per-browser setting (language, mute) that components can read with a hook.
 * Kept in localStorage when allowed, and in memory otherwise, so it still works in a
 * private window; it just isn't remembered across reloads there.
 */
export function storedSetting<T extends string>(key: string, isValid: (v: unknown) => v is T, fallback: T) {
  let memory = fallback;
  const listeners = new Set<() => void>();

  const read = (): T => {
    try {
      const saved = window.localStorage.getItem(key);
      return isValid(saved) ? saved : memory;
    } catch {
      return memory;
    }
  };

  const write = (value: T) => {
    memory = value;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Not remembered; fine.
    }
    for (const notify of listeners) notify();
  };

  const subscribe = (notify: () => void) => {
    listeners.add(notify);
    window.addEventListener("storage", notify);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", notify);
    };
  };

  const useValue = () => useSyncExternalStore(subscribe, read, () => fallback);
  return { useValue, write };
}
