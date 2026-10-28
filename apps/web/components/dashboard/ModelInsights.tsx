import type { InsightRow, Method } from "@/lib/dashboard";
import { formatAccuracy, MODEL_STATUS_LABEL, MODELS, type ModelKey } from "@/lib/models";

const ROWS: { method: Method; label: string; model: ModelKey | null }[] = [
  { method: "voice", label: "Voice", model: "voice" },
  { method: "gesture", label: "Gesture", model: "gesture" },
  { method: "manual", label: "Tap on screen", model: null },
];

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value)}%`);

/** How each input performs today (from selection_events) plus model status from models.json. */
export function ModelInsights({ rows }: { rows: InsightRow[] }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5" aria-labelledby="insights-title">
      <h2 id="insights-title" className="text-lg">
        Model insights (today)
      </h2>
      <p className="mt-1 text-sm text-muted">
        Confirmed = the passenger accepted the board&rsquo;s choice without pressing Change.
      </p>

      <ul className="mt-4 divide-y divide-line">
        {ROWS.map(({ method, label, model }) => {
          const row = rows.find((r) => r.method === method);
          const info = model ? MODELS[model] : null;
          return (
            <li key={method} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{label}</span>
                {info ? (
                  <span className="text-right text-sm text-muted">
                    {MODEL_STATUS_LABEL[info.status]} · test acc.{" "}
                    <span className="num text-ink">{formatAccuracy(info.testAccuracy)}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted">Fallback, no model</span>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-muted">Selections</dt>
                  <dd className="num text-lg font-semibold">{row?.selections ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-muted">Confirmed</dt>
                  <dd className="num text-lg font-semibold">{pct(row?.confirmationRate ?? null)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Avg confidence</dt>
                  <dd className="num text-lg font-semibold">
                    {row?.avgConfidence == null ? "—" : row.avgConfidence.toFixed(2)}
                  </dd>
                </div>
              </dl>
              {row && row.selections > 0 ? (
                <p className="num mt-1 text-xs text-muted">
                  {row.confirmed} confirmed · {row.changed} changed · {row.cancelledOrTimeout} cancelled or timed out
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
