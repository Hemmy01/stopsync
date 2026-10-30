import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ink" | "quiet" | "danger";
type Size = "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:border-ink",
  ink: "bg-ink text-paper hover:opacity-90",
  quiet: "text-muted hover:text-ink hover:bg-surface",
  danger: "bg-danger text-white hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-14 px-6 text-base gap-2",
  xl: "h-20 px-8 text-[22px] gap-3",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks clicks while an action runs. */
  pending?: boolean;
  pendingLabel?: string;
  icon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  pending = false,
  pendingLabel,
  icon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-card font-semibold transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60",
        pending && "cursor-wait",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {pending ? <Loader2 aria-hidden className="h-[1.1em] w-[1.1em] animate-spin" /> : icon}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
