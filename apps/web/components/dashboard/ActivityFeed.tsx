import { BusFront, Check, Flag, Lightbulb, MapPin, Navigation, RotateCcw, Ticket, Users, X } from "lucide-react";
import type { ActivityItem, ActivityKind } from "@/lib/dashboard";
import { getDestination } from "@/lib/destinations";
import { formatKigaliTime } from "@/lib/time";

const ICONS: Record<ActivityKind, typeof Ticket> = {
  token: Ticket,
  recommendation: Lightbulb,
  approved: Check,
  dismissed: X,
  released: BusFront,
  departed: Navigation,
  arrived: MapPin,
  completed: Flag,
  occupancy: Users,
  reset: RotateCcw,
};

/** Live feed, newest first. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="flex min-h-0 flex-col rounded-card border border-line bg-surface" aria-labelledby="feed-title">
      <h2 id="feed-title" className="border-b border-line px-5 py-4 text-lg">
        Activity
      </h2>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Nothing yet. New tickets, recommendations and buses appear here.</p>
      ) : (
        <ol className="max-h-[560px] overflow-y-auto" aria-live="polite">
          {items.map((item) => {
            const Icon = ICONS[item.kind];
            const dest = item.destination ? getDestination(item.destination) : undefined;
            return (
              <li key={item.key} className="flex items-start gap-3 border-b border-line px-5 py-3 last:border-b-0">
                <time className="num w-12 shrink-0 pt-0.5 text-sm text-muted" dateTime={item.at}>
                  {formatKigaliTime(new Date(item.at))}
                </time>
                <span
                  aria-hidden
                  className="mt-0.5 h-5 w-1 shrink-0 rounded-pill"
                  style={{ backgroundColor: dest?.color ?? "var(--line)" }}
                />
                <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <p className="text-sm">
                  {dest ? <span className="num mr-1.5 font-semibold">{dest.route}</span> : null}
                  {item.text}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
