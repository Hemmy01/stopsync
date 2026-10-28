"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { formatKigaliTime } from "@/lib/time";

interface KigaliClockProps {
  withSeconds?: boolean;
  className?: string;
}

/** Live 24-hour clock in Kigali time. Renders a placeholder until mounted. */
export function KigaliClock({ withSeconds = false, className }: KigaliClockProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time
      className={clsx("num", className)}
      dateTime={now?.toISOString()}
      aria-label={now ? `Kigali time ${formatKigaliTime(now)}` : "Kigali time"}
    >
      {now ? formatKigaliTime(now, withSeconds) : withSeconds ? "--:--:--" : "--:--"}
    </time>
  );
}
