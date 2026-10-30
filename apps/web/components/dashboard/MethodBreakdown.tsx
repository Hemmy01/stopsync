import type { Method, MethodShare } from "@/lib/dashboard";

const METHOD_STYLE: Record<Method, { label: string; color: string }> = {
  voice: { label: "Voice (ML)", color: "var(--ink)" },
  gesture: { label: "Gesture (ML)", color: "var(--accent)" },
  manual: { label: "Tap on screen", color: "var(--muted)" },
};

/** Stacked bar of how passengers chose their stop today. */
export function MethodBreakdown({ total, shares }: { total: number; shares: MethodShare[] }) {
  const ml = shares.filter((s) => s.method === "voice" || s.method === "gesture").reduce((n, s) => n + s.count, 0);

  return (
    <section className="rounded-card border border-line bg-surface p-5" aria-labelledby="methods-title">
      <div className="flex items-baseline justify-between">
        <h2 id="methods-title" className="text-lg">
          How passengers chose (today)
        </h2>
        <span className="text-sm text-muted">
          <span className="num font-semibold text-ink">{total}</span> tickets
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-muted">No tickets yet today.</p>
      ) : (
        <>
          <div className="mt-4 flex h-6 gap-0.5 overflow-hidden rounded-pill" aria-hidden>
            {shares
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.method}
                  className="h-full transition-[flex-grow] duration-200 ease-out"
                  style={{ flexGrow: s.count, backgroundColor: METHOD_STYLE[s.method].color }}
                />
              ))}
          </div>
          <p className="mt-3 text-sm">
            <span className="num font-semibold">{Math.round((ml / total) * 100)}%</span>
            <span className="text-muted"> chose by voice or gesture, recognised on the board</span>
          </p>
        </>
      )}

      <ul className="mt-4 grid gap-y-2 text-sm">
        {shares.map((s) => (
          <li key={s.method} className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: METHOD_STYLE[s.method].color }} />
            <span className="flex-1">{METHOD_STYLE[s.method].label}</span>
            <span className="num font-semibold">{s.count}</span>
            <span className="num w-10 text-right text-muted">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
