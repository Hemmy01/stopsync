import type { DepartureStatus } from "@/lib/departures";
import { StepCountdown } from "./StepCountdown";
import { TicketCard } from "./TicketCard";

interface TicketStageProps {
  heading: string;
  subheading?: string;
  code: string;
  destination: string;
  position?: number;
  status: DepartureStatus;
  statusLine: string;
  timeoutMs: number;
  onDone: () => void;
}

/** Steps 4 and 5: a new ticket, or the card's existing one. */
export function TicketStage({ heading, subheading, timeoutMs, onDone, ...ticket }: TicketStageProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6">
        <h1 className="text-[44px] leading-[1.05]">{heading}</h1>
        {subheading ? <p className="mt-2 text-[22px] text-muted">{subheading}</p> : null}
      </div>

      <TicketCard {...ticket} />

      <div className="mt-auto flex items-end justify-between pt-6">
        <StepCountdown ms={timeoutMs} label="Back to start in" />
        <button
          type="button"
          onClick={onDone}
          className="h-16 min-w-[200px] rounded-card bg-ink px-8 text-[22px] font-semibold text-paper transition-opacity duration-200 ease-out hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}
