import clsx from "clsx";
import { BusFront } from "lucide-react";
import type { BusProgress, Route } from "@/lib/routes";
import { useKioskText } from "@/lib/use-kiosk-text";

interface RouteStripProps {
  route: Route;
  progress: BusProgress;
  /** CSS colour of the route, e.g. var(--route-2). */
  color: string;
  busId: string;
  /** "Bus R2-01 · passed Kiyovu · 1 stop away · about 6 min" */
  caption: string;
}

/**
 * Linear stop diagram: terminal on the left, this kiosk on the right, the bus between
 * the two stops it is travelling between. Passed stops are filled, upcoming ones hollow.
 */
export function RouteStrip({ route, progress, color, busId, caption }: RouteStripProps) {
  const { t } = useKioskText();
  const { stops } = route;
  const at = progress.stripFraction ?? 0;
  const pct = (i: number) => (stops.length > 1 ? (i / (stops.length - 1)) * 100 : 0);

  return (
    <figure className="w-full max-w-[1040px]">
      <figcaption key={caption} className="animate-tick mb-1 text-[22px] font-semibold" aria-live="polite">
        {caption}
      </figcaption>
      <div className="relative mx-14 h-14">
        {/* Track: travelled part in the route colour, the rest as a quiet line. */}
        <div aria-hidden className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-pill bg-line" />
        <div
          aria-hidden
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-pill transition-[width] duration-200 ease-out"
          style={{ width: `${at * 100}%`, backgroundColor: color }}
        />
        {stops.map((stop, i) => {
          const passed = progress.lastIndex !== null && i <= progress.lastIndex;
          const kiosk = i === stops.length - 1;
          return (
            <span
              key={stop.id}
              aria-hidden
              className={clsx(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-surface",
                kiosk ? "h-6 w-6 border-ink" : "h-4 w-4",
              )}
              style={{
                left: `${pct(i)}%`,
                borderColor: kiosk ? undefined : color,
                backgroundColor: passed && !kiosk ? color : undefined,
              }}
            />
          );
        })}
        <span
          className="absolute top-1/2 flex h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-pill px-3 text-white transition-[left] duration-200 ease-out"
          style={{ left: `${at * 100}%`, backgroundColor: color }}
        >
          <BusFront aria-hidden className="h-5 w-5" />
          <span className="num text-base font-semibold">{busId}</span>
        </span>
      </div>
      <ol className="relative mx-14 mt-1 h-10 text-sm text-muted" aria-label={t.stopsOnRoute(route.route)}>
        {stops.map((stop, i) => {
          const kiosk = i === stops.length - 1;
          return (
            <li
              key={stop.id}
              className={clsx(
                "absolute w-28 leading-tight",
                i === 0 ? "text-left" : kiosk ? "-translate-x-full text-right" : "-translate-x-1/2 text-center",
                kiosk && "font-semibold text-ink",
              )}
              style={{ left: `${pct(i)}%` }}
            >
              {kiosk ? t.thisStop : stop.name}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
