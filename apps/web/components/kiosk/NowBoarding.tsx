import { RouteBadge } from "@/components/RouteBadge";
import { ticketRange, type Boarding } from "@/lib/queue";
import { useKioskText } from "@/lib/use-kiosk-text";

/** "Now boarding" row above the departure strip: which tickets each bus at the stop called. */
export function NowBoarding({ boardings }: { boardings: readonly Boarding[] }) {
  const { t } = useKioskText();
  if (boardings.length === 0) return null;
  return (
    <section aria-label={t.nowBoarding} aria-live="polite" className="flex shrink-0 flex-wrap gap-x-8 gap-y-2 border-t border-line bg-paper px-6 py-2">
      <p className="self-center text-sm font-semibold uppercase tracking-[0.14em] text-accent">{t.nowBoarding}</p>
      {boardings.map((b) => (
        <p key={b.busId} className="flex items-center gap-3 text-lg">
          <RouteBadge code={b.destination} size="sm" />
          <span>
            <span className="num font-semibold">{b.busId}</span> {t.boardingTickets(b.count)}{" "}
            <span className="num font-semibold">{ticketRange(b)}</span>
          </span>
        </p>
      ))}
    </section>
  );
}
