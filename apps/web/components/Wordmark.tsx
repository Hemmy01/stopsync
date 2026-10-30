import clsx from "clsx";

/** Tap&Select wordmark: a station marker (as on a transit map) and the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-3", className)}>
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink"
      >
        <span className="h-3.5 w-3.5 rounded-full border-[3px] border-paper" />
      </span>
      <span className="font-display text-2xl font-bold tracking-tight">Tap&Select</span>
    </span>
  );
}
