"use client";

import clsx from "clsx";
import Link from "next/link";
import { Banner } from "@/components/Banner";
import { LiveMap } from "@/components/dashboard/LiveMap";
import { HomeLink } from "@/components/HomeLink";
import { KigaliClock } from "@/components/KigaliClock";
import { NowBoarding } from "@/components/kiosk/NowBoarding";
import { RouteBadge } from "@/components/RouteBadge";
import { countByDestination, departureLabel, departureStatus } from "@/lib/departures";
import { DESTINATIONS } from "@/lib/destinations";
import { boardingNow } from "@/lib/queue";
import { formatKigaliTime } from "@/lib/time";
import { useLiveBoard } from "@/lib/use-live-board";
import { useNow } from "@/lib/use-now";

/** Read-only view for the audience: no sign-in, nothing to click that changes anything. */
export function LiveBoardApp() {
  const { board, error } = useLiveBoard();
  const now = useNow(5_000);
  const kioskWaiting = countByDestination((board?.tokens ?? []).filter((t) => t.status === "waiting"));
  const boardings = board ? boardingNow(board.buses, board.tokens) : [];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-12 sm:px-8">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-4">
        <HomeLink />
        <h1 className="text-[28px]">Live board</h1>
        <KigaliClock className="ml-auto text-xl text-muted" />
      </header>

      <p className="mt-4 text-muted">
        {board?.stop?.name ?? "Kiosk 1"} · read-only, updates every few seconds
        {board?.updatedAt ? (
          <>
            {" "}
            · last <span className="num">{formatKigaliTime(new Date(board.updatedAt))}</span>
          </>
        ) : null}
      </p>

      {error ? (
        <Banner tone="danger" title="Can't reach Tap&Select right now" className="mt-4">
          {error} The board will try again by itself.
        </Banner>
      ) : null}

      <section aria-labelledby="departures-title" className="mt-6">
        <h2 id="departures-title" className="text-lg">
          Departures
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {DESTINATIONS.map((d) => {
            const status = departureStatus(d.code, board?.buses ?? []);
            const label = departureLabel(status);
            const atKiosk = kioskWaiting[d.code] ?? 0;
            const onRoute = board?.networkWaiting[d.code] ?? 0;
            return (
              <li key={d.code} className="flex items-center gap-4 rounded-card border border-line bg-surface p-4">
                <RouteBadge code={d.code} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[22px] font-semibold leading-tight">{d.name}</p>
                  <p
                    key={label}
                    className={clsx(
                      "animate-tick truncate",
                      status.kind === "waiting" ? "text-muted" : "font-semibold",
                      status.kind === "on_the_way" && "num",
                    )}
                  >
                    {status.kind === "boarding" ? <span className="text-accent">● </span> : null}
                    {label}
                  </p>
                  <p className="text-sm text-muted">
                    <span className="num">{board ? onRoute : "–"}</span> waiting along the route
                  </p>
                </div>
                <div className="text-right">
                  <p className="overflow-hidden text-[36px] font-bold leading-none">
                    <span key={atKiosk} className="num inline-block animate-tick">
                      {board ? atKiosk : "–"}
                    </span>
                  </p>
                  <p className="text-sm text-muted">at this stop</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {boardings.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-card border border-line">
          <NowBoarding boardings={boardings} />
        </div>
      ) : null}

      {board && now ? (
        <div className="mt-6">
          <LiveMap routes={board.routes} buses={board.buses} now={now} />
        </div>
      ) : null}

      <footer className="mt-10 text-sm text-muted">
        Tap&Select prototype · CMU-Africa Bridge Program ·{" "}
        <Link href="/about" className="font-semibold text-ink underline underline-offset-4">
          How it works
        </Link>
      </footer>
    </div>
  );
}
