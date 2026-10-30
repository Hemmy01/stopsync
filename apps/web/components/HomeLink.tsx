import clsx from "clsx";
import Link from "next/link";
import { Wordmark } from "./Wordmark";

/** The wordmark as a link back to the home page, used in every screen's header. */
export function HomeLink({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Tap&Select home" className={clsx("inline-flex shrink-0 rounded-lg", className)}>
      <Wordmark />
    </Link>
  );
}
