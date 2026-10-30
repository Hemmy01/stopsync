"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useKioskText } from "@/lib/use-kiosk-text";

interface SoundToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
}

/** Mutes the spoken ticket numbers and boarding calls. */
export function SoundToggle({ on, onChange }: SoundToggleProps) {
  const { t } = useKioskText();
  const Icon = on ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      title={on ? t.soundOn : t.soundOff}
      className="flex h-14 w-14 items-center justify-center rounded-pill border border-line bg-surface text-ink transition-colors duration-200 ease-out hover:border-ink"
    >
      <Icon aria-hidden className="h-6 w-6" />
      <span className="sr-only">{on ? t.soundOn : t.soundOff}</span>
    </button>
  );
}
