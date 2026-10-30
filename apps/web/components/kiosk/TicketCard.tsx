import clsx from "clsx";
import { BusFront, Clock3, MapPin } from "lucide-react";
import { RouteBadge } from "@/components/RouteBadge";
import type { DepartureStatus } from "@/lib/departures";
import { getDestination } from "@/lib/destinations";

interface TicketCardProps {
  code: string;
  destination: string;
  /** Omitted for an existing ticket shown again. */
  position?: number;
  status: DepartureStatus;
  statusLine: string;
}

const STATUS_ICON = { waiting: Clock3, on_the_way: BusFront, boarding: MapPin } as const;

/**
 * Boarding-pass ticket: route-colour band, huge mono code, and a perforated
 * stub with the live status.
 */
export function TicketCard({ code, destination, position, status, statusLine }: TicketCardProps) {
  const dest = getDestination(destination);
  const Icon = STATUS_ICON[status.kind];

  return (
    <article
      aria-label={`Queue number ${code} to ${dest?.name ?? destination}`}
      className="relative flex w-full max-w-[1040px] overflow-hidden rounded-card border border-line bg-surface"
    >
      <div aria-hidden className="w-5 shrink-0" style={{ backgroundColor: dest?.color ?? "var(--ink)" }} />

      <div className="flex-1 px-10 py-8">
        <p className="text-base font-semibold uppercase tracking-[0.14em] text-muted">Queue number</p>
        <p className="num mt-1 text-[120px] font-bold leading-none tracking-tight">{code}</p>
        <div className="mt-6 flex items-center gap-4">
          <RouteBadge code={destination} size="md" />
          <div>
            <p className="font-display text-[28px] font-semibold leading-tight">{dest?.name ?? destination}</p>
            {position !== undefined ? (
              <p className="text-lg text-muted">
                Position <span className="num font-medium text-ink">{position}</span> in the queue
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Perforation: dashed rule with a notch cut from the top and bottom edge. */}
      <div aria-hidden className="relative w-0 border-l-2 border-dashed border-line">
        <span className="absolute -top-4 -left-4 h-8 w-8 rounded-full border border-line bg-paper" />
        <span className="absolute -bottom-4 -left-4 h-8 w-8 rounded-full border border-line bg-paper" />
      </div>

      <div className="flex w-[340px] shrink-0 flex-col justify-between px-8 py-8" aria-live="polite">
        <p className="text-base font-semibold uppercase tracking-[0.14em] text-muted">Status</p>
        <div>
          <Icon
            aria-hidden
            className={clsx("h-10 w-10", status.kind === "waiting" ? "text-muted" : "text-accent")}
          />
          <p key={statusLine} className="animate-tick mt-3 font-display text-[28px] font-semibold leading-tight">
            {statusLine}
          </p>
        </div>
        <p className="text-base text-muted">Updates live</p>
      </div>
    </article>
  );
}
