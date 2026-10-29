"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LANG, isLang, KIOSK_TEXT, type KioskText, type Lang } from "./kiosk-text";
import { storedSetting } from "./stored-setting";

// The kiosk's language, remembered in this browser.
const language = storedSetting("tapselect.kiosk.lang", isLang, DEFAULT_LANG);

interface KioskLanguage {
  lang: Lang;
  t: KioskText;
  setLang: (lang: Lang) => void;
}

const KioskTextContext = createContext<KioskLanguage>({
  lang: DEFAULT_LANG,
  t: KIOSK_TEXT[DEFAULT_LANG],
  setLang: language.write,
});

export function KioskTextProvider({ children }: { children: ReactNode }) {
  const lang = language.useValue();
  return (
    <KioskTextContext.Provider value={{ lang, t: KIOSK_TEXT[lang], setLang: language.write }}>{children}</KioskTextContext.Provider>
  );
}

export const useKioskText = () => useContext(KioskTextContext);
