"use client";

import clsx from "clsx";
import { LANGS, KIOSK_TEXT } from "@/lib/kiosk-text";
import { useKioskText } from "@/lib/use-kiosk-text";

/** English | Kinyarwanda, each in its own language, so anyone can find theirs. */
export function LanguageSwitch() {
  const { lang, setLang } = useKioskText();
  return (
    <div role="group" aria-label="Language / Ururimi" className="flex h-14 items-center rounded-pill border border-line bg-surface p-1">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={KIOSK_TEXT[l].htmlLang}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={clsx(
            "h-12 rounded-pill px-5 text-lg font-semibold transition-colors duration-200 ease-out",
            lang === l ? "bg-ink text-paper" : "text-muted hover:text-ink",
          )}
        >
          {KIOSK_TEXT[l].name}
        </button>
      ))}
    </div>
  );
}
