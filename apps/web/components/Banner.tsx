import clsx from "clsx";
import { AlertTriangle, Info, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

type BannerTone = "info" | "warn" | "danger" | "offline";

const TONES: Record<BannerTone, { className: string; Icon: typeof Info }> = {
  info: { className: "border-line bg-surface text-ink", Icon: Info },
  warn: { className: "border-warn bg-surface text-ink", Icon: AlertTriangle },
  danger: { className: "border-danger bg-surface text-ink", Icon: AlertTriangle },
  offline: { className: "border-ink bg-ink text-paper", Icon: WifiOff },
};

const ICON_COLOUR: Record<BannerTone, string> = {
  info: "text-muted",
  warn: "text-warn",
  danger: "text-danger",
  offline: "text-paper",
};

interface BannerProps {
  tone?: BannerTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Friendly status message. Tone is always paired with an icon and text. */
export function Banner({ tone = "info", title, children, action, className }: BannerProps) {
  const { className: toneClass, Icon } = TONES[tone];
  return (
    <div
      role={tone === "danger" || tone === "offline" ? "alert" : "status"}
      className={clsx(
        "flex items-start gap-3 rounded-card border-l-4 border px-4 py-3",
        toneClass,
        className,
      )}
    >
      <Icon aria-hidden className={clsx("mt-0.5 h-5 w-5 shrink-0", ICON_COLOUR[tone])} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-0.5 text-[0.95em] opacity-90">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
