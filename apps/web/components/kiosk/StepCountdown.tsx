"use client";

import { useEffect, useState } from "react";

interface StepCountdownProps {
  ms: number;
  /** e.g. "Cancels in" or "Back to start in". */
  label: string;
}

/**
 * Seconds left in the current step plus a thin draining bar. Mounted with its
 * stage, so it restarts whenever the step changes.
 */
export function StepCountdown({ ms, label }: StepCountdownProps) {
  const [left, setLeft] = useState(Math.ceil(ms / 1000));

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setLeft(Math.max(0, Math.ceil((ms - (Date.now() - start)) / 1000)));
    }, 250);
    return () => window.clearInterval(id);
  }, [ms]);

  return (
    <div className="w-full max-w-xs" aria-live="off">
      <p className="text-base text-muted">
        {label} <span className="num font-medium text-ink">{left}</span> s
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-pill bg-line">
        <div
          className="h-full origin-left bg-ink"
          style={{ animation: `drain ${ms}ms linear forwards` }}
        />
      </div>
    </div>
  );
}
