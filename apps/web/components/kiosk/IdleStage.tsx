"use client";

import { Loader2, Nfc, X } from "lucide-react";
import { useEffect, useState } from "react";
import { RouteBadge } from "@/components/RouteBadge";
import { DEMO_CARDS, newTestCardId } from "@/lib/demo-cards";
import { DESTINATIONS } from "@/lib/destinations";

interface IdleStageProps {
  /** True while the tapped card is being checked. */
  reading: boolean;
  onTap: (cardId: string) => void;
}

/** Small sign: the voice name and tap gesture for each stop. */
function HowToChoose() {
  return (
    <section aria-labelledby="how-to-choose" className="mt-8 max-w-xl rounded-card border border-line bg-surface">
      <h2 id="how-to-choose" className="border-b border-line px-5 py-3 text-base font-semibold uppercase tracking-[0.12em] text-muted">
        How to choose your stop
      </h2>
      <table className="w-full text-lg">
        <thead className="sr-only">
          <tr>
            <th>Stop</th>
            <th>Say</th>
            <th>Or over the sensor</th>
          </tr>
        </thead>
        <tbody>
          {DESTINATIONS.map((d) => (
            <tr key={d.code} className="border-b border-line last:border-b-0">
              <td className="py-2 pl-5">
                <span className="flex items-center gap-3">
                  <RouteBadge code={d.code} size="sm" />
                  <span className="font-semibold">{d.name}</span>
                </span>
              </td>
              <td className="py-2 text-muted">Say &ldquo;{d.name}&rdquo;</td>
              <td className="py-2 pr-5 text-muted">{d.gestureHint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
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
          Then say your stop or tap over the sensor. You&rsquo;ll get a queue number and live bus times.
        </p>
        <HowToChoose />
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
              {/* New passenger on every tap: unlimited tries in tests and demos. */}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setPicking(false);
                    onTap(newTestCardId());
                  }}
                  className="flex h-16 w-full items-center justify-between rounded-card border border-dashed border-ink px-5 text-left font-semibold transition-colors duration-200 ease-out hover:bg-paper"
                >
                  <span>Test card</span>
                  <span className="text-base font-normal text-muted">New passenger every tap</span>
                </button>
              </li>
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
