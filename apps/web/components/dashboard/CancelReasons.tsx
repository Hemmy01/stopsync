import type { CancellationStats } from "@/lib/cancel-reasons";

/** "Why people left today": one bar per reason plus the share of tickets cancelled. */
export function CancelReasons({ stats }: { stats: CancellationStats }) {
  const max = Math.max(1, ...stats.reasons.map((r) => r.count));

  return (
    <section className="rounded-card border border-line bg-surface p-5" aria-labelledby="cancel-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="cancel-title" className="text-lg">
          Why people left (today)
        </h2>
        <span className="text-sm text-muted">
          <span className="num font-semibold text-ink">{stats.cancelled}</span> cancelled
        </span>
      </div>

      <p className="mt-3 text-sm">
        <span className="num text-[28px] font-bold leading-none">{stats.ratePct}%</span>
        <span className="text-muted">
          {" "}
          cancellation rate · <span className="num">{stats.cancelled}</span> of{" "}
          <span className="num">{stats.tickets}</span> tickets
        </span>
      </p>

      {stats.cancelled === 0 ? (
        <p className="mt-4 text-sm text-muted">Nobody has given up their place today.</p>
      ) : (
        <ul className="mt-4 grid gap-y-2.5 text-sm">
          {stats.reasons.map((r) => (
            <li key={r.code} title={`${r.label}: ${r.count}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span>{r.label}</span>
                <span className="num font-semibold">{r.count}</span>
              </div>
              <div className="mt-1 h-2 rounded-pill bg-paper" aria-hidden>
                <div
                  className="h-full rounded-pill bg-ink transition-[width] duration-200 ease-out"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
