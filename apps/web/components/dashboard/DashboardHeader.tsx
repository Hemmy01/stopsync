import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { KigaliClock } from "@/components/KigaliClock";
import { Wordmark } from "@/components/Wordmark";
import type { Totals } from "@/lib/dashboard";

interface DashboardHeaderProps {
  totals: Totals | null;
  onRecompute: () => void;
  recomputing: boolean;
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

export function DashboardHeader({ totals, onRecompute, recomputing }: DashboardHeaderProps) {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-4 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="StopSync home">
          <Wordmark />
        </Link>
        <h1 className="text-[28px]">HQ Dashboard</h1>
        <KigaliClock withSeconds className="text-xl text-muted" />
        <div className="ml-auto flex flex-wrap items-center gap-6">
          <Stat label="Waiting now" value={totals?.waiting ?? null} />
          <Stat label="Boarded today" value={totals?.boardedToday ?? null} />
          <Stat label="Buses on the way" value={totals?.onTheWay ?? null} />
          <Button
            size="lg"
            onClick={onRecompute}
            pending={recomputing}
            pendingLabel="Recomputing…"
            icon={<RefreshCw aria-hidden className="h-4 w-4" />}
          >
            Recompute now
          </Button>
        </div>
      </div>
    </header>
  );
}
