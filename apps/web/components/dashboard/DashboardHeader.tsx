import { RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { AccountBadge } from "@/components/auth/AccountBadge";
import { Button } from "@/components/Button";
import { KigaliClock } from "@/components/KigaliClock";
import { Wordmark } from "@/components/Wordmark";
import type { Totals } from "@/lib/dashboard";
import { ResetDemoButton } from "./ResetDemoButton";

interface DashboardHeaderProps {
  totals: Totals | null;
  onRecompute: () => void;
  recomputing: boolean;
  onResetDemo: () => void;
  resetting: boolean;
  /** Dispatcher or admin: Recompute now. */
  canDispatch: boolean;
  /** Admin: Reset demo and Users. */
  canAdminister: boolean;
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="min-w-[120px]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="num overflow-hidden text-[32px] font-bold leading-tight">
        <span key={value ?? "x"} className="inline-block animate-tick">
          {value ?? "–"}
        </span>
      </p>
    </div>
  );
}

export function DashboardHeader({
  totals,
  onRecompute,
  recomputing,
  onResetDemo,
  resetting,
  canDispatch,
  canAdminister,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Tap&Select home">
          <Wordmark />
        </Link>
        <h1 className="text-[28px]">HQ Dashboard</h1>
        <KigaliClock withSeconds className="text-xl text-muted" />
        <div className="ml-auto flex flex-wrap items-center gap-6">
          <Stat label="Waiting now" value={totals?.waiting ?? null} />
          <Stat label="Boarded today" value={totals?.boardedToday ?? null} />
          <Stat label="Buses on the way" value={totals?.onTheWay ?? null} />
          {canDispatch ? (
            <Button
              size="lg"
              onClick={onRecompute}
              pending={recomputing}
              pendingLabel="Recomputing…"
              icon={<RefreshCw aria-hidden className="h-4 w-4" />}
            >
              Recompute now
            </Button>
          ) : null}
          {canAdminister ? <ResetDemoButton onConfirm={onResetDemo} pending={resetting} /> : null}
          {canAdminister ? (
            <Link
              href="/admin/users"
              className="inline-flex h-14 items-center gap-2 rounded-card border border-line bg-surface px-6 font-semibold transition-colors duration-200 ease-out hover:border-ink"
            >
              <Users aria-hidden className="h-4 w-4" />
              Users
            </Link>
          ) : null}
          <AccountBadge />
        </div>
      </div>
    </header>
  );
}
