"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { actionForKey, progressSegments, slideFromHash } from "@/lib/pitch-nav";
import { SLIDES } from "./slides";

const W = 1280;
const H = 720;
const COUNT = SLIDES.length;
const ROUTE_COLOURS = ["var(--route-1)", "var(--route-2)", "var(--route-3)", "var(--route-4)"];

const noopSubscribe = () => () => {};

function subscribeResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** Scale of the 1280×720 canvas so it fits the window (letterboxed). */
function useCanvasScale(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => Math.min(window.innerWidth / W, window.innerHeight / H),
    () => 1,
  );
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function ProgressBar({ slide }: { slide: number }) {
  return (
    <div className="flex h-1.5 gap-1" aria-hidden>
      {progressSegments(slide, COUNT).map((fill, i) => (
        <span key={i} className="h-full flex-1 overflow-hidden bg-line">
          <span
            className="block h-full transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${fill * 100}%`, background: ROUTE_COLOURS[i] }}
          />
        </span>
      ))}
    </div>
  );
}

/** Every slide on its own page, for "Save as PDF" (/pitch?print=1). */
function PrintDeck() {
  return (
    <div className="bg-paper">
      <style>{`@page { size: ${W}px ${H}px; margin: 0 } body { background: var(--paper) }`}</style>
      {SLIDES.map((slide, i) => (
        <section
          key={slide.title}
          className="relative overflow-hidden bg-paper [break-after:page]"
          style={{ width: W, height: H }}
          aria-label={`Slide ${i + 1}: ${slide.title}`}
        >
          {slide.body}
          <span className="num absolute right-16 bottom-5 text-[16px] text-muted">
            {String(i + 1).padStart(2, "0")} / {COUNT}
          </span>
        </section>
      ))}
    </div>
  );
}

function Presenter() {
  const scale = useCanvasScale();
  const slide = useSyncExternalStore(
    subscribeHash,
    () => slideFromHash(window.location.hash, COUNT),
    () => 1,
  );
  const [notesOpen, setNotesOpen] = useState(false);

  const go = useCallback((n: number) => {
    // replaceState keeps Back for leaving the deck; dispatch so the hash store updates.
    history.replaceState(null, "", `#${n}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const action = actionForKey(e.key, slideFromHash(window.location.hash, COUNT), COUNT);
      if (!action) return;
      e.preventDefault();
      if (action.type === "go") go(action.slide);
      else if (action.type === "toggle-notes") setNotesOpen((open) => !open);
      else if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => {});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const current = SLIDES[slide - 1];

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-ink">
      <div
        className="relative shrink-0 overflow-hidden bg-paper"
        style={{ width: W, height: H, transform: `scale(${scale})` }}
      >
        <div className="absolute inset-x-0 top-0 z-10">
          <ProgressBar slide={slide} />
        </div>
        <section
          key={slide}
          className="h-full motion-safe:animate-[slide-in_200ms_ease-out]"
          aria-roledescription="slide"
          aria-label={`Slide ${slide} of ${COUNT}: ${current.title}`}
        >
          {current.body}
        </section>
        <span className="num absolute right-16 bottom-5 text-[16px] text-muted">
          {String(slide).padStart(2, "0")} / {COUNT}
        </span>
        <span className="absolute bottom-5 left-16 text-[14px] text-muted">← → move · F fullscreen · N notes</span>

        {notesOpen ? (
          <aside
            className="absolute inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-surface px-16 py-6"
            aria-label="Speaker notes"
          >
            <p className="text-[16px] font-semibold uppercase tracking-[0.12em] text-muted">
              Speaker notes · {current.speaker}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-[22px] leading-snug">
              {current.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>

      <nav className="sr-only" aria-label="Slides">
        <button type="button" onClick={() => go(Math.max(slide - 1, 1))}>
          Previous slide
        </button>
        <button type="button" onClick={() => go(Math.min(slide + 1, COUNT))}>
          Next slide
        </button>
      </nav>
    </div>
  );
}

export function PitchDeck() {
  const print = useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("print") === "1",
    () => false,
  );
  return print ? <PrintDeck /> : <Presenter />;
}
