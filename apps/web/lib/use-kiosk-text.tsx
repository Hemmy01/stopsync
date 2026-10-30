"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_LANG, isLang, KIOSK_TEXT, type KioskText, type Lang } from "./kiosk-text";

const STORAGE_KEY = "tapselect.kiosk.lang";

// The kiosk's language, remembered in this browser. If storage is blocked it still switches,
// just not across reloads.
let memoryLang: Lang = DEFAULT_LANG;
const listeners = new Set<() => void>();

function readLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isLang(saved) ? saved : memoryLang;
  } catch {
    return memoryLang;
  }
}

function writeLang(lang: Lang) {
  memoryLang = lang;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not remembered; fine.
  }
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

interface KioskLanguage {
  lang: Lang;
  t: KioskText;
  setLang: (lang: Lang) => void;
}

const KioskTextContext = createContext<KioskLanguage>({
  lang: DEFAULT_LANG,
  t: KIOSK_TEXT[DEFAULT_LANG],
  setLang: writeLang,
});

export function KioskTextProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => DEFAULT_LANG);
  return <KioskTextContext.Provider value={{ lang, t: KIOSK_TEXT[lang], setLang: writeLang }}>{children}</KioskTextContext.Provider>;
}

export const useKioskText = () => useContext(KioskTextContext);
