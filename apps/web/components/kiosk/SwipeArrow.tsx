import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { SwipeDirection } from "@/lib/destinations";

const ICON = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown } as const;

/** The swipe direction as an arrow. Decorative: always shown next to its text. */
export function SwipeArrow({ direction, className }: { direction: SwipeDirection; className?: string }) {
  const Icon = ICON[direction];
  return <Icon aria-hidden strokeWidth={2.5} className={className} />;
}
