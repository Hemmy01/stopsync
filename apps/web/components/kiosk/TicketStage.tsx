import type { ReactNode } from "react";
import type { TicketStatus } from "@/lib/queue";
import { StepCountdown } from "./StepCountdown";
import { TicketCard } from "./TicketCard";

interface TicketStageProps {
  heading: string;
  subheading?: string;
  code: string;
  destination: string;
  position?: number;
  status: TicketStatus;
  timeoutMs: number;
  onDone: () => void;
  /** Shown under the ticket, e.g. the route strip while the bus is on the way. */
  below?: ReactNode;
  /** Offered when the ticket is still waiting: the passenger can give up their place. */
  onCancelPlace?: () => void;
}

/** Steps 4 and 5: a new ticket, or the card's existing one. */
export function TicketStage({ heading, subheading, timeoutMs, onDone, below, onCancelPlace, ...ticket }: TicketStageProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-start justify-between gap-8">
        <div>
          <h1 className="text-[44px] leading-[1.05]">{heading}</h1>
          {subheading && !below ? <p className="mt-2 text-[22px] text-muted">{subheading}</p> : null}
        </div>
        {onCancelPlace ? (
          <button
            type="button"
            onClick={onCancelPlace}
            className="h-14 shrink-0 rounded-card border border-line bg-surface px-6 font-semibold text-danger transition-colors duration-200 ease-out hover:border-danger"
          >
            Cancel my place
          </button>
        ) : null}
      </div>

      <TicketCard {...ticket} compact={Boolean(below)} />

      {below ? (
        // The strip takes the room the countdown row would, so Done sits beside it.
        <div className="mt-5 flex shrink-0 items-end gap-6">
          <div className="min-w-0 flex-1">{below}</div>
          <div className="flex w-[200px] shrink-0 flex-col gap-3 pb-2">
            <StepCountdown ms={timeoutMs} label="Back to start in" />
            <DoneButton onDone={onDone} />
          </div>
        </div>
      ) : (
        <div className="mt-auto flex items-end justify-between pt-6">
          <StepCountdown ms={timeoutMs} label="Back to start in" />
          <DoneButton onDone={onDone} />
        </div>
      )}
    </div>
  );
}

function DoneButton({ onDone }: { onDone: () => void }) {
  return (
    <button
      type="button"
      onClick={onDone}
      className="h-16 min-w-[200px] rounded-card bg-ink px-8 text-[22px] font-semibold text-paper transition-opacity duration-200 ease-out hover:opacity-90"
    >
      Done
    </button>
  );
}
