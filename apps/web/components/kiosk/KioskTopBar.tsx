import type { ReactNode } from "react";
import { KigaliClock } from "@/components/KigaliClock";
import { HomeLink } from "@/components/HomeLink";
import type { BoardStatus } from "@/lib/use-board";
import { BoardStatusPill } from "./BoardStatusPill";
import { LanguageSwitch } from "./LanguageSwitch";

interface KioskTopBarProps {
  stopName: string;
  boardStatus: BoardStatus;
  /** Slot for the "Connect board" control. */
  actions?: ReactNode;
  /** The mute switch, when this browser can speak. */
  sound?: ReactNode;
}

export function KioskTopBar({ stopName, boardStatus, actions, sound }: KioskTopBarProps) {
  return (
    <header className="flex h-20 shrink-0 items-center gap-6 border-b border-line bg-paper px-8">
      <HomeLink />
      <span aria-hidden className="h-8 w-px bg-line" />
      <span className="text-lg font-semibold">{stopName}</span>
      <div className="ml-auto flex items-center gap-4">
        <LanguageSwitch />
        {sound}
        <BoardStatusPill status={boardStatus} />
        {actions}
        <KigaliClock className="ml-2 text-[32px] font-medium" />
      </div>
    </header>
  );
}
