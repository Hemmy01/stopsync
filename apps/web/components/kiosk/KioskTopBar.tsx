import type { ReactNode } from "react";
import { KigaliClock } from "@/components/KigaliClock";
import { Wordmark } from "@/components/Wordmark";
import type { BoardStatus } from "@/lib/use-board";
import { BoardStatusPill } from "./BoardStatusPill";

interface KioskTopBarProps {
  stopName: string;
  boardStatus: BoardStatus;
  /** Slot for the "Connect board" control. */
  actions?: ReactNode;
}

export function KioskTopBar({ stopName, boardStatus, actions }: KioskTopBarProps) {
  return (
    <header className="flex h-20 shrink-0 items-center gap-6 border-b border-line bg-paper px-8">
      <Wordmark />
      <span aria-hidden className="h-8 w-px bg-line" />
      <span className="text-lg font-semibold">{stopName}</span>
      <div className="ml-auto flex items-center gap-4">
        <BoardStatusPill status={boardStatus} />
        {actions}
        <KigaliClock className="ml-2 text-[32px] font-medium" />
      </div>
    </header>
  );
}
