import clsx from "clsx";
import { getDestination } from "@/lib/destinations";

type BadgeSize = "sm" | "md" | "lg" | "xl";

// Text is always bold and >= 19px so white on every route colour meets
// WCAG AA for large text.
const SIZES: Record<BadgeSize, string> = {
  sm: "h-10 w-10 rounded-lg text-[19px]",
  md: "h-12 w-12 rounded-lg text-[22px]",
  lg: "h-16 w-16 rounded-xl text-[28px]",
  xl: "h-24 w-24 rounded-xl text-[40px]",
};

interface RouteBadgeProps {
  /** Destination code, e.g. "KIM". */
  code: string;
  size?: BadgeSize;
  className?: string;
}

/** Rounded square in the route colour with the route id in white mono. */
export function RouteBadge({ code, size = "md", className }: RouteBadgeProps) {
  const dest = getDestination(code);
  return (
    <span
      className={clsx(
        "num inline-flex shrink-0 items-center justify-center font-bold leading-none text-white",
        SIZES[size],
        className,
      )}
      style={{ backgroundColor: dest?.color ?? "var(--ink)" }}
      aria-label={dest ? `Route ${dest.route}` : code}
    >
      {dest?.route ?? code}
    </span>
  );
}
