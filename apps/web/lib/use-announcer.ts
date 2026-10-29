"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { storedSetting } from "./stored-setting";

const sound = storedSetting("tapselect.kiosk.sound", (v): v is "on" | "off" => v === "on" || v === "off", "on");

/** Older announcements are dropped rather than read out minutes late. */
const MAX_QUEUED = 3;

const noSubscribe = () => () => {};

/**
 * Speaks short announcements with the browser's built-in voice. While `hold` is true (the
 * board's microphone is listening for a stop name) nothing is spoken: what is queued waits,
 * and anything already playing stops, so the kiosk never "says" a stop into its own mic.
 */
export function useAnnouncer({ hold }: { hold: boolean }) {
  const soundOn = sound.useValue() === "on";
  const supported = useSyncExternalStore(noSubscribe, () => "speechSynthesis" in window, () => false);
  const queue = useRef<string[]>([]);

  const flush = useCallback(() => {
    if (hold || !soundOn || !supported) return;
    for (const text of queue.current.splice(0)) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-GB";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }, [hold, soundOn, supported]);

  // Speak what waited once the board stops listening.
  useEffect(flush, [flush]);

  useEffect(() => {
    if (hold && supported) window.speechSynthesis.cancel();
  }, [hold, supported]);

  const say = useCallback(
    (text: string) => {
      if (!soundOn || !supported) return;
      queue.current = [...queue.current, text].slice(-MAX_QUEUED);
      flush();
    },
    [soundOn, supported, flush],
  );

  const setSoundOn = useCallback(
    (on: boolean) => {
      if (!on && supported) {
        queue.current = [];
        window.speechSynthesis.cancel();
      }
      sound.write(on ? "on" : "off");
    },
    [supported],
  );

  return { soundOn, supported, setSoundOn, say };
}
