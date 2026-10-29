import { Hand } from "lucide-react";
import { RouteBadge } from "@/components/RouteBadge";
import { getDestination, swipeDirection } from "@/lib/destinations";
import type { Selection } from "@/lib/kiosk-machine";
import type { BoardGestureMode } from "@/lib/protocol";
import { useKioskText } from "@/lib/use-kiosk-text";
import { SwipeArrow } from "./SwipeArrow";

interface DetectedStageProps {
  selection: Selection;
  gestureMode: BoardGestureMode;
}

/** Between listening and confirm: the gesture the board recognised, e.g. "→ Downtown". */
export function DetectedStage({ selection, gestureMode }: DetectedStageProps) {
  const { t } = useKioskText();
  const dest = getDestination(selection.code);
  if (!dest) return null;
  const swipes = gestureMode === "swipe";

  return (
    <div className="flex h-full flex-col">
      <p className="text-lg font-semibold uppercase tracking-[0.12em] text-muted" role="status">
        {t.gestureRecognised} · {t.gestureHint(selection.code, gestureMode)}
      </p>
      <div className="flex flex-1 animate-tick items-center gap-10">
        {swipes ? (
          <SwipeArrow direction={swipeDirection(dest.gestureLabel)} className="h-32 w-32 shrink-0 text-ink" />
        ) : (
          <Hand aria-hidden className="h-28 w-28 shrink-0 text-ink" />
        )}
        <RouteBadge code={dest.code} size="xl" />
        <h1 className="text-[72px] leading-none">{dest.name}</h1>
      </div>
    </div>
  );
}
