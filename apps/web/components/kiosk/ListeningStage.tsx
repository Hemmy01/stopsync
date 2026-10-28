import { RouteBadge } from "@/components/RouteBadge";
import { DESTINATIONS, type DestinationCode } from "@/lib/destinations";
import { STEP_TIMEOUT_MS } from "@/lib/kiosk-machine";
import { StepCountdown } from "./StepCountdown";

interface ListeningStageProps {
  onSelect: (code: DestinationCode) => void;
  onCancel: () => void;
}

function ListeningIndicator() {
  return (
    <span aria-hidden className="flex h-10 items-center gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="h-full w-1.5 origin-center rounded-pill bg-accent"
          style={{ animation: `listen 1.6s ease-in-out ${i * 0.16}s infinite` }}
        />
      ))}
    </span>
  );
}

/** Step 2: the board listens; tiles are the tap fallback. */
export function ListeningStage({ onSelect, onCancel }: ListeningStageProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-8">
        <div>
          <div className="flex items-center gap-4">
            <ListeningIndicator />
            <p className="text-lg font-semibold text-accent" role="status">
              Listening
            </p>
          </div>
          <h1 className="mt-3 text-[52px] leading-[1.05]">Say your stop or show a gesture</h1>
        </div>
        <StepCountdown ms={STEP_TIMEOUT_MS.listening ?? 20_000} label="Cancels in" />
      </div>

      <p className="mt-auto mb-4 text-[22px] text-muted">Tap a stop if I didn&rsquo;t catch it</p>
      <ul className="grid grid-cols-4 gap-4">
        {DESTINATIONS.map((d) => (
          <li key={d.code}>
            <button
              type="button"
              onClick={() => onSelect(d.code)}
              className="flex h-[180px] w-full flex-col justify-between rounded-card border border-line bg-surface p-6 text-left transition-colors duration-200 ease-out hover:border-ink"
            >
              <RouteBadge code={d.code} size="lg" />
              <span className="font-display text-[32px] font-semibold leading-tight">{d.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-14 rounded-card border border-line px-6 font-semibold text-ink transition-colors duration-200 ease-out hover:border-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
