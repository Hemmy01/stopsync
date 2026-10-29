import { Hand, Loader2, Mic, MousePointerClick } from "lucide-react";
import { Banner } from "@/components/Banner";
import { RouteBadge } from "@/components/RouteBadge";
import { getDestination } from "@/lib/destinations";
import { STEP_TIMEOUT_MS, type Selection } from "@/lib/kiosk-machine";
import { useKioskText } from "@/lib/use-kiosk-text";
import { StepCountdown } from "./StepCountdown";

interface ConfirmStageProps {
  selection: Selection;
  submitting: boolean;
  error?: string;
  onConfirm: () => void;
  onChange: () => void;
}

const METHOD_ICON = { voice: Mic, gesture: Hand, manual: MousePointerClick } as const;

/** Step 3: "Kimironko?" with how it was chosen, then Confirm or Change. */
export function ConfirmStage({ selection, submitting, error, onConfirm, onChange }: ConfirmStageProps) {
  const { t } = useKioskText();
  const dest = getDestination(selection.code);
  const Icon = METHOD_ICON[selection.method];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-8">
        <p className="text-lg font-semibold uppercase tracking-[0.12em] text-muted">{t.isThisYourStop}</p>
        {submitting ? null : <StepCountdown ms={STEP_TIMEOUT_MS.confirm ?? 15_000} label={t.cancelsIn} />}
      </div>

      <div className="flex flex-1 items-center gap-10">
        <RouteBadge code={selection.code} size="xl" />
        <div>
          <h1 className="text-[56px] leading-none">{dest?.name ?? selection.code}?</h1>
          <p className="mt-5 inline-flex h-11 items-center gap-2 rounded-pill border border-line bg-surface px-4 text-lg font-semibold">
            <Icon aria-hidden className="h-5 w-5 text-muted" />
            <span className="tabular-nums">{t.selection(selection)}</span>
          </p>
        </div>
      </div>

      {error ? (
        <Banner tone="danger" title={t.numberFailed} className="mb-5">
          {error} {t.tryAgainOrChange}
        </Banner>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          aria-busy={submitting}
          className="inline-flex h-[72px] min-w-[320px] items-center justify-center gap-3 rounded-card bg-accent px-10 text-[26px] font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90 disabled:cursor-wait disabled:opacity-80"
        >
          {submitting ? (
            <>
              <Loader2 aria-hidden className="h-7 w-7 animate-spin" />
              {t.gettingNumber}
            </>
          ) : (
            t.confirm
          )}
        </button>
        <button
          type="button"
          onClick={onChange}
          disabled={submitting}
          className="h-[72px] rounded-card border border-line bg-surface px-10 text-[22px] font-semibold transition-colors duration-200 ease-out hover:border-ink disabled:opacity-50"
        >
          {t.change}
        </button>
      </div>
    </div>
  );
}
