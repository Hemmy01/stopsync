import { CheckCircle2, Loader2 } from "lucide-react";
import { Banner } from "@/components/Banner";
import { RouteBadge } from "@/components/RouteBadge";
import type { CancelReason } from "@/lib/cancel-reasons";
import { getDestination } from "@/lib/destinations";
import { STEP_TIMEOUT_MS } from "@/lib/kiosk-machine";
import { useKioskText } from "@/lib/use-kiosk-text";
import { StepCountdown } from "./StepCountdown";

const KEEP_BUTTON =
  "h-[72px] rounded-card border border-line bg-surface px-10 text-[22px] font-semibold transition-colors duration-200 ease-out hover:border-ink disabled:opacity-50";

function TicketLine({ code, destination }: { code: string; destination: string }) {
  return (
    <p className="flex items-center gap-4 text-[26px]">
      <RouteBadge code={destination} />
      <span className="num font-bold">{code}</span>
      <span className="text-muted">{getDestination(destination)?.name ?? destination}</span>
    </p>
  );
}

interface CancelReasonStageProps {
  code: string;
  destination: string;
  reasons: readonly CancelReason[];
  error: string | null;
  onChoose: (reason: string) => void;
  onKeep: () => void;
}

/** "Why are you leaving the queue?" as big tiles. */
export function CancelReasonStage({ code, destination, reasons, error, onChoose, onKeep }: CancelReasonStageProps) {
  const { t } = useKioskText();
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-start justify-between gap-8">
        <div>
          <h1 className="text-[44px] leading-[1.05]">{t.whyLeaving}</h1>
          <div className="mt-3">
            <TicketLine code={code} destination={destination} />
          </div>
        </div>
        <StepCountdown ms={STEP_TIMEOUT_MS.cancel_reason ?? 20_000} label={t.keepsPlaceIn} />
      </div>

      {error ? (
        <Banner tone="danger" title={t.reasonsFailed} className="mb-5">
          {error} {t.placeKept}
        </Banner>
      ) : null}

      <ul className="grid grid-cols-3 gap-4">
        {reasons.map((r) => (
          <li key={r.code}>
            <button
              type="button"
              onClick={() => onChoose(r.code)}
              className="flex h-[112px] w-full items-center rounded-card border border-line bg-surface px-6 text-left font-display text-[24px] font-semibold leading-tight transition-colors duration-200 ease-out hover:border-ink"
            >
              {t.reason(r)}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex justify-end pt-5">
        <button type="button" onClick={onKeep} className={KEEP_BUTTON}>
          {t.keepMyPlace}
        </button>
      </div>
    </div>
  );
}

interface CancelConfirmStageProps {
  code: string;
  destination: string;
  reasonLabel: string;
  pending: boolean;
  error?: string;
  onConfirm: () => void;
  onKeep: () => void;
}

/** Last check before the place is given up: it can't be undone. */
export function CancelConfirmStage({ code, destination, reasonLabel, pending, error, onConfirm, onKeep }: CancelConfirmStageProps) {
  const { t } = useKioskText();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-8">
        <p className="text-lg font-semibold uppercase tracking-[0.12em] text-muted">{t.cancelYourPlace}</p>
        {pending ? null : <StepCountdown ms={STEP_TIMEOUT_MS.cancel_confirm ?? 15_000} label={t.keepsPlaceIn} />}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-5">
        <h1 className="text-[56px] leading-none">{t.giveUpPlace}</h1>
        <TicketLine code={code} destination={destination} />
        <p className="text-[22px] text-muted">
          {t.reasonIs} <span className="font-semibold text-ink">{reasonLabel}</span>. {t.startAtBack}
        </p>
      </div>

      {error ? (
        <Banner tone="danger" title={t.cancelFailed} className="mb-5">
          {error}
        </Banner>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex h-[72px] min-w-[360px] items-center justify-center gap-3 rounded-card bg-danger px-10 text-[26px] font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90 disabled:cursor-wait disabled:opacity-80"
        >
          {pending ? (
            <>
              <Loader2 aria-hidden className="h-7 w-7 animate-spin" />
              {t.cancelling}
            </>
          ) : (
            t.yesCancel
          )}
        </button>
        <button type="button" onClick={onKeep} disabled={pending} className={KEEP_BUTTON}>
          {t.keepMyPlace}
        </button>
      </div>
    </div>
  );
}

/** Done: the place is free for the next passenger. */
export function CancelledStage({ code, destination, onDone }: { code: string; destination: string; onDone: () => void }) {
  const { t } = useKioskText();
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col justify-center gap-5">
        <CheckCircle2 aria-hidden className="h-14 w-14 text-accent" />
        <h1 className="text-[56px] leading-none">{t.placeCancelled}</h1>
        <TicketLine code={code} destination={destination} />
        <p className="text-[22px] text-muted">{t.thanksForWhy}</p>
      </div>
      <div className="flex items-end justify-between">
        <StepCountdown ms={STEP_TIMEOUT_MS.cancelled ?? 8_000} label={t.backToStartIn} />
        <button
          type="button"
          onClick={onDone}
          className="h-16 min-w-[200px] rounded-card bg-ink px-8 text-[22px] font-semibold text-paper transition-opacity duration-200 ease-out hover:opacity-90"
        >
          {t.done}
        </button>
      </div>
    </div>
  );
}
