"use client";

import { useCallback, useRef, useState } from "react";
import type { ActionResult } from "./rpc";

function withoutKey(record: Readonly<Record<string, string>>, key: string): Record<string, string> {
  const next = { ...record };
  delete next[key];
  return next;
}

/**
 * Runs async actions by key with a pending state and no double-submits:
 * while a key is running, calling it again does nothing.
 */
export function useActions() {
  const running = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});

  const run = useCallback(async (key: string, fn: () => Promise<ActionResult>): Promise<ActionResult | null> => {
    if (running.current.has(key)) return null;
    running.current.add(key);
    setPending(new Set(running.current));
    setErrors((e) => withoutKey(e, key));

    let result: ActionResult;
    try {
      result = await fn();
    } catch (err) {
      result = { ok: false, message: err instanceof Error ? err.message : "Network error" };
    }

    running.current.delete(key);
    setPending(new Set(running.current));
    if (!result.ok) {
      const { message } = result;
      setErrors((e) => ({ ...e, [key]: message }));
    }
    return result;
  }, []);

  const isPending = useCallback((key: string) => pending.has(key), [pending]);
  const clearError = useCallback((key: string) => setErrors((e) => withoutKey(e, key)), []);

  return { run, isPending, errors, clearError };
}
