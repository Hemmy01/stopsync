import clsx from "clsx";
import { Hand } from "lucide-react";
import { RouteBadge } from "@/components/RouteBadge";
import { DESTINATIONS, swipeDirection, type DestinationCode } from "@/lib/destinations";
import { STEP_TIMEOUT_MS } from "@/lib/kiosk-machine";
import type { BoardGestureMode } from "@/lib/protocol";
import type { LiveGesture } from "@/lib/use-kiosk";
import { useKioskText } from "@/lib/use-kiosk-text";
import { StepCountdown } from "./StepCountdown";
import { SwipeArrow } from "./SwipeArrow";

interface ListeningStageProps {
  gestureMode: BoardGestureMode;
  /** The last gesture the sensor reported, while it is fresh. */
  liveGesture: LiveGesture | null;
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

/** "Sensor saw: ← Swipe left", announced politely to screen readers. */
function SensorFeedback({ gesture }: { gesture: LiveGesture | null }) {
  const { t } = useKioskText();
  return (
    <p aria-live="polite" className="flex h-14 items-center">
      {gesture ? (
        <span
          key={gesture.id}
          className="inline-flex h-14 items-center gap-3 rounded-pill border border-ink bg-surface px-5 text-[22px] font-semibold animate-tick"
        >
          <span className="font-normal text-muted">{t.sensorSaw}</span>
          {gesture.direction ? <SwipeArrow direction={gesture.direction} className="h-7 w-7" /> : null}
          {gesture.text}
        </span>
      ) : null}
    </p>
  );
}

/** Step 2: the board listens; tiles are the tap fallback. */
export function ListeningStage({ gestureMode, liveGesture, onSelect, onCancel }: ListeningStageProps) {
  const { t } = useKioskText();
  const swipes = gestureMode === "swipe";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-8">
        <div>
          <div className="flex items-center gap-4">
            <ListeningIndicator />
            <p className="text-lg font-semibold text-accent" role="status">
              {t.listening}
            </p>
          </div>
          <h1 className="mt-3 text-[52px] leading-[1.05]">{t.listenHeading(gestureMode)}</h1>
        </div>
        <StepCountdown ms={STEP_TIMEOUT_MS.listening ?? 20_000} label={t.cancelsIn} />
      </div>

      <div className="mt-auto mb-4 flex items-end justify-between gap-6">
        <p className="text-[22px] text-muted">{t.tapIfMissed}</p>
        {gestureMode === "off" ? null : <SensorFeedback gesture={liveGesture} />}
      </div>
      <ul className="grid grid-cols-4 gap-4">
        {DESTINATIONS.map((d) => {
          const seen = liveGesture?.code === d.code;
          return (
            <li key={d.code}>
              <button
                type="button"
                onClick={() => onSelect(d.code)}
                className={clsx(
                  "flex h-[216px] w-full flex-col justify-between rounded-card border bg-surface p-6 text-left transition-colors duration-200 ease-out hover:border-ink",
                  seen ? "border-ink" : "border-line",
                )}
              >
                <span className="flex w-full items-start justify-between">
                  <RouteBadge code={d.code} size="lg" />
                  {gestureMode === "off" ? null : swipes ? (
                    <SwipeArrow direction={swipeDirection(d.gestureLabel)} className="h-14 w-14 text-ink" />
                  ) : (
                    <Hand aria-hidden className="h-10 w-10 text-muted" />
                  )}
                </span>
                <span>
                  <span className="block font-display text-[32px] font-semibold leading-tight">{d.name}</span>
                  <span className="mt-1 block text-lg leading-snug text-muted">{t.say(d.name)}</span>
                  {gestureMode === "off" ? null : (
                    <span className={clsx("block text-lg leading-snug", swipes ? "font-semibold text-ink" : "text-muted")}>
                      {t.gestureHint(d.code, gestureMode)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="h-14 rounded-card border border-line px-6 font-semibold text-ink transition-colors duration-200 ease-out hover:border-ink"
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
