import clsx from "clsx";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/Button";
import { RouteBadge } from "@/components/RouteBadge";
import type { Decision, DestinationSummary } from "@/lib/dashboard";
import type { Bus } from "@/lib/departures";

export interface CardActions {
  approve: (decision: Decision) => void;
  dismiss: (decision: Decision) => void;
  arrive: (bus: Bus) => void;
  reset: (bus: Bus) => void;
  isPending: (key: string) => boolean;
  errorFor: (keys: string[]) => string | undefined;
}

interface DestinationCardProps {
  code: string;
  name: string;
  capacity: number;
  releaseLoadPct: number;
  summary: DestinationSummary;
  buses: Bus[];
  pending: Decision | undefined;
  actions: CardActions;
}

const BUS_STATUS: Record<string, string> = {
  at_terminal: "At terminal",
  on_the_way: "On the way",
  arrived: "Arrived · boarding",
};

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{children}</p>;
}

function LoadBar({ pct, high, threshold }: { pct: number; high: boolean; threshold: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">Load</span>
        <span className={clsx("num font-semibold", high && "text-ink")}>
          {high ? <AlertTriangle aria-hidden className="mr-1 inline h-4 w-4 text-warn" /> : null}
          {pct}%{high ? ` · above ${threshold}%` : ""}
        </span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-pill bg-paper"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
        aria-label="Load of bus capacity"
      >
        <div
          className={clsx("h-full rounded-pill transition-[width] duration-200 ease-out", high ? "bg-warn" : "bg-ink")}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function BusRow({ bus, actions }: { bus: Bus; actions: CardActions }) {
  const arriveKey = `arrive-${bus.id}`;
  const resetKey = `reset-${bus.id}`;
  return (
    <li className="flex min-h-11 items-center gap-3">
      <span className="num w-14 font-semibold">{bus.id}</span>
      <span className={clsx("flex-1 text-sm", bus.status === "at_terminal" ? "text-muted" : "font-semibold")}>
        {BUS_STATUS[bus.status] ?? bus.status}
        {bus.status === "on_the_way" && bus.eta_minutes != null ? (
          <span className="num"> · {bus.eta_minutes} min</span>
        ) : null}
      </span>
      {bus.status === "on_the_way" ? (
        <Button size="md" onClick={() => actions.arrive(bus)} pending={actions.isPending(arriveKey)}>
          Bus arrived
        </Button>
      ) : null}
      {bus.status === "arrived" ? (
        <Button size="md" onClick={() => actions.reset(bus)} pending={actions.isPending(resetKey)}>
          Reset bus
        </Button>
      ) : null}
    </li>
  );
}

function Recommendation({ decision, actions }: { decision: Decision | undefined; actions: CardActions }) {
  if (!decision) {
    return <p className="text-sm text-muted">No recommendation yet. Dispatch runs every minute.</p>;
  }
  if (decision.action === "hold") {
    return (
      <p className="text-sm">
        <span className="font-semibold">Hold</span>
        <span className="text-muted"> · {decision.reason}</span>
      </p>
    );
  }
  const approveKey = `approve-${decision.id}`;
  const dismissKey = `dismiss-${decision.id}`;
  return (
    <div className="rounded-card border border-accent bg-paper p-3">
      <p className="font-semibold text-accent">Release a bus</p>
      <p className="text-sm">{decision.reason}</p>
      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          icon={<Check aria-hidden className="h-4 w-4" />}
          onClick={() => actions.approve(decision)}
          pending={actions.isPending(approveKey)}
          disabled={actions.isPending(dismissKey)}
          pendingLabel="Approving…"
          className="flex-1"
        >
          Approve
        </Button>
        <Button
          icon={<X aria-hidden className="h-4 w-4" />}
          onClick={() => actions.dismiss(decision)}
          pending={actions.isPending(dismissKey)}
          disabled={actions.isPending(approveKey)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function DestinationCard({
  code,
  name,
  capacity,
  releaseLoadPct,
  summary,
  buses,
  pending,
  actions,
}: DestinationCardProps) {
  const error = actions.errorFor([
    ...(pending ? [`approve-${pending.id}`, `dismiss-${pending.id}`] : []),
    ...buses.flatMap((b) => [`arrive-${b.id}`, `reset-${b.id}`]),
  ]);

  return (
    <article className="flex flex-col rounded-card border border-line bg-surface" aria-label={name}>
      <header className="flex items-center gap-3 border-b border-line p-4">
        <RouteBadge code={code} size="sm" />
        <h2 className="flex-1 text-xl">{name}</h2>
        <span className="text-sm text-muted">
          Bus <span className="num">{capacity}</span> seats
        </span>
      </header>

      <div className="space-y-4 border-b border-line p-4">
        <div className="flex items-end justify-between">
          <div>
            <SectionLabel>Waiting</SectionLabel>
            <p className="num overflow-hidden text-[56px] font-bold leading-none">
              <span key={summary.waiting} className="inline-block animate-tick">
                {summary.waiting}
              </span>
            </p>
          </div>
          <p className="pb-1 text-right text-sm text-muted">
            Oldest wait
            <br />
            <span className="num text-lg font-semibold text-ink">
              {summary.oldestWaitMin === null ? "–" : `${summary.oldestWaitMin} min`}
            </span>
          </p>
        </div>
        <LoadBar pct={summary.loadPct} high={summary.highLoad} threshold={releaseLoadPct} />
      </div>

      <div className="border-b border-line p-4">
        <SectionLabel>Buses</SectionLabel>
        <ul className="space-y-1">
          {buses.map((bus) => (
            <BusRow key={bus.id} bus={bus} actions={actions} />
          ))}
        </ul>
      </div>

      <div className="flex-1 p-4">
        <SectionLabel>Recommendation</SectionLabel>
        <Recommendation decision={pending} actions={actions} />
        {error ? (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm font-semibold text-danger">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}
