"use client";

import { Loader2, Nfc, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DEMO_CARDS } from "@/lib/demo-cards";

interface IdleStageProps {
  /** True while the tapped card is being checked. */
  reading: boolean;
  onTap: (cardId: string) => void;
}

/** Step 1: "Tap your card to begin", with a simulated card reader. */
export function IdleStage({ reading, onTap }: IdleStageProps) {
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPicking(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  return (
    <div className="grid h-full grid-cols-[1fr_480px] items-center gap-16">
      <div>
        <p className="text-lg font-semibold uppercase tracking-[0.12em] text-muted">Welcome</p>
        <h1 className="mt-3 text-[56px] leading-[1.05]">Tap your card to begin</h1>
        <p className="mt-5 max-w-lg text-[22px] text-muted">
          Then say your stop or show a gesture. You&rsquo;ll get a queue number and live bus times.
        </p>
      </div>

      <div className="relative">
        {picking && !reading ? (
          <div className="rounded-card border border-line bg-surface p-4" role="dialog" aria-label="Choose a demo card">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-base font-semibold uppercase tracking-[0.12em] text-muted">Simulated RFID</p>
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="flex h-14 w-14 items-center justify-center rounded-card text-muted hover:bg-paper"
                aria-label="Close"
              >
                <X aria-hidden className="h-6 w-6" />
              </button>
            </div>
            <ul className="grid gap-2">
              {DEMO_CARDS.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    autoFocus={card.id === DEMO_CARDS[0].id}
                    onClick={() => {
                      setPicking(false);
                      onTap(card.id);
                    }}
                    className="flex h-16 w-full items-center justify-between rounded-card border border-line px-5 text-left font-semibold transition-colors duration-200 ease-out hover:border-ink"
                  >
                    <span>{card.label}</span>
                    <span className="num text-base font-normal text-muted">{card.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={reading}
            className="group flex h-[360px] w-full flex-col items-center justify-center rounded-card border border-line bg-surface transition-colors duration-200 ease-out hover:border-ink disabled:cursor-wait"
          >
            <span className="relative flex h-40 w-40 items-center justify-center">
              <span aria-hidden className="absolute inset-0 rounded-full border border-line" />
              <span aria-hidden className="absolute inset-5 rounded-full border border-line" />
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-ink text-paper">
                {reading ? (
                  <Loader2 aria-hidden className="h-10 w-10 animate-spin" />
                ) : (
                  <Nfc aria-hidden className="h-11 w-11" />
                )}
              </span>
            </span>
            <span className="mt-6 font-display text-[28px] font-semibold">
              {reading ? "Reading card…" : "Hold your card here"}
            </span>
            <span className="mt-2 text-base text-muted">Simulated RFID · click to choose a demo card</span>
          </button>
        )}
      </div>
    </div>
  );
}
