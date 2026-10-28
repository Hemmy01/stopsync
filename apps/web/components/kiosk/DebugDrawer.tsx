"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { RouteBadge } from "@/components/RouteBadge";
import { DESTINATIONS } from "@/lib/destinations";
import type { MockBoard } from "@/lib/serial";
import { STOP_ID } from "@/lib/supabase";
import { formatKigaliTime } from "@/lib/time";
import type { LogEntry } from "@/lib/use-board";

interface DebugDrawerProps {
  mock: MockBoard;
  log: readonly LogEntry[];
  onClose: () => void;
}

const DIRECTION = {
  in: { arrow: "← ", className: "text-accent" },
  out: { arrow: "→ ", className: "text-route-1" },
  sys: { arrow: "• ", className: "text-muted" },
} as const;

const VOICE_CONF = 0.91;
const GESTURE_CONF = 0.88;

function EmitButton({ line, onEmit, children }: { line: string; onEmit: (l: string) => void; children?: string }) {
  return (
    <button
      type="button"
      onClick={() => onEmit(line)}
      className="num h-10 whitespace-nowrap rounded-lg border border-line bg-surface px-3 text-sm transition-colors duration-150 ease-out hover:border-ink"
      title={line}
    >
      {children ?? line}
    </button>
  );
}

/** Mock board + raw serial log. Toggle with D or ?mock=1. */
export function DebugDrawer({ mock, log, onClose }: DebugDrawerProps) {
  const [raw, setRaw] = useState("");
  const emit = (line: string) => mock.emit(line);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (raw.trim() === "") return;
    emit(raw);
    setRaw("");
  };

  return (
    <aside
      aria-label="Debug drawer"
      className="fixed inset-y-0 right-0 z-50 flex w-[440px] flex-col border-l border-ink bg-paper text-base"
    >
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-line px-5">
        <div>
          <p className="font-display text-xl font-bold">Mock board</p>
          <p className="text-sm text-muted">Same parser as the real board · press D to hide</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close debug drawer"
          className="flex h-12 w-12 items-center justify-center rounded-card hover:bg-surface"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </header>

      <div className="space-y-5 overflow-y-auto border-b border-line p-5">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted">Board</h2>
          <div className="flex flex-wrap gap-2">
            <EmitButton line={`HELLO,${STOP_ID}`} onEmit={emit} />
            <EmitButton line="STATE,LISTENING" onEmit={emit} />
            <EmitButton line="STATE,IDLE" onEmit={emit} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted">Select</h2>
          <ul className="space-y-2">
            {DESTINATIONS.map((d) => (
              <li key={d.code} className="flex items-center gap-3">
                <RouteBadge code={d.code} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                <EmitButton line={`SELECT,${d.code},voice,${VOICE_CONF}`} onEmit={emit}>
                  {`voice ${VOICE_CONF}`}
                </EmitButton>
                <EmitButton line={`SELECT,${d.code},gesture,${GESTURE_CONF}`} onEmit={emit}>
                  {`gesture ${GESTURE_CONF}`}
                </EmitButton>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted">Raw line</h2>
          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="e.g. SELECT,XXX,voice,2"
              aria-label="Raw serial line"
              className="num h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm"
            />
            <button type="submit" className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-paper">
              Emit
            </button>
          </form>
        </section>
      </div>

      <section className="flex min-h-0 flex-1 flex-col">
        <h2 className="px-5 pt-4 pb-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          Serial log
        </h2>
        <ol className="num min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-[13px] leading-relaxed">
          {log.length === 0 ? <li className="text-muted">No lines yet.</li> : null}
          {log.map((entry) => (
            <li key={entry.id} className="border-b border-line py-1">
              <span className="text-muted">{formatKigaliTime(entry.at, true)} </span>
              <span className={DIRECTION[entry.direction].className}>{DIRECTION[entry.direction].arrow}</span>
              <span className={clsx(entry.note?.startsWith("Ignored") && "text-muted line-through")}>
                {entry.text}
              </span>
              {entry.note ? <span className="block pl-[88px] text-danger">{entry.note}</span> : null}
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
