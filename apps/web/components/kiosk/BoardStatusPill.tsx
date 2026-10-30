import clsx from "clsx";
import type { BoardStatus } from "@/lib/use-board";

const PILL: Record<BoardStatus, { label: string; dot: string; className: string }> = {
  connected: { label: "Connected", dot: "bg-accent", className: "border-accent text-ink" },
  not_connected: { label: "Not connected", dot: "border-2 border-muted bg-transparent", className: "border-line text-muted" },
  mock: { label: "Mock mode", dot: "bg-warn", className: "border-warn text-ink" },
};

/** Board connection state: always a text label, never colour alone. */
export function BoardStatusPill({ status }: { status: BoardStatus }) {
  const pill = PILL[status];
  return (
    <span
      className={clsx(
        "inline-flex h-10 items-center gap-2 rounded-pill border bg-surface px-4 text-base font-semibold",
        pill.className,
      )}
    >
      <span aria-hidden className={clsx("h-2.5 w-2.5 rounded-full", pill.dot)} />
      <span>
        <span className="sr-only">Board: </span>
        {pill.label}
      </span>
    </span>
  );
}
