"use client";

import { useMemo } from "react";
import { Banner } from "@/components/Banner";
import { canAdminister, canDispatch } from "@/lib/auth";
import { cancellationStats } from "@/lib/cancel-reasons";
import {
  buildActivity,
  computeTotals,
  configValue,
  insightRows,
  methodBreakdown,
  pendingByDestination,
  summarizeDestination,
} from "@/lib/dashboard";
import { DESTINATIONS } from "@/lib/destinations";
import { dispatchPlaces, totalPlaces } from "@/lib/occupancy";
import {
  approveDecision,
  dismissDecision,
  markBusArrived,
  resetBus,
  resetDemo,
  runDispatch,
  updateConfig,
  type ActionResult,
} from "@/lib/rpc";
import { getSupabase } from "@/lib/supabase";
import { useActions } from "@/lib/use-actions";
import { useAccount } from "@/lib/use-account";
import { useDashboardData } from "@/lib/use-dashboard-data";
import { useNow } from "@/lib/use-now";
import { useRoutes } from "@/lib/use-routes";
import { ActivityFeed } from "./ActivityFeed";
import { DashboardHeader } from "./DashboardHeader";
import { DestinationCard, type CardActions } from "./DestinationCard";
import { LiveMap } from "./LiveMap";
import { CancelReasons } from "./CancelReasons";
import { MethodBreakdown } from "./MethodBreakdown";
import { ModelInsights } from "./ModelInsights";
import { SettingsPanel } from "./SettingsPanel";

function CardSkeleton() {
  return <div className="h-[460px] animate-pulse rounded-card border border-line bg-surface" aria-hidden />;
}

export function DashboardApp() {
  const account = useAccount();
  const dispatcher = canDispatch(account.role);
  const admin = canAdminister(account.role);
  const { data, loading, error, reload } = useDashboardData();
  const { run, isPending, errors } = useActions();
  const now = useNow();
  const { routes, error: routesError } = useRoutes();
  const stopNames = useMemo(() => new Map(routes.flatMap((r) => r.stops.map((st) => [st.id, st.name]))), [routes]);
  // Until routes load, count every stop (as before Phase 5).
  const servedStopsOf = (code: string) => {
    const route = routes.find((r) => r.route === DESTINATIONS.find((d) => d.code === code)?.route);
    return route ? new Set(route.stops.map((st) => st.id)) : undefined;
  };

  const act = (key: string, fn: () => Promise<ActionResult>) => {
    void run(key, fn).then(reload);
  };

  const actions: CardActions = {
    approve: (d) => act(`approve-${d.id}`, () => approveDecision(getSupabase(), d.id)),
    dismiss: (d) => act(`dismiss-${d.id}`, () => dismissDecision(getSupabase(), d.id)),
    arrive: (b) => act(`arrive-${b.id}`, () => markBusArrived(getSupabase(), b.id, "dashboard")),
    reset: (b) => act(`reset-${b.id}`, () => resetBus(getSupabase(), b.id)),
    isPending,
    errorFor: (keys) => keys.map((k) => errors[k]).find(Boolean),
  };

  const derived = useMemo(() => {
    if (!data) return null;
    return {
      totals: computeTotals(data.tokens, data.buses, data.dayStart),
      methods: methodBreakdown(data.tokens, data.dayStart),
      insights: insightRows(data.insights),
      pending: pendingByDestination(data.decisions),
      activity: buildActivity(
        data.tokens.filter((t) => t.created_at >= data.dayStart),
        data.decisions,
        data.events,
        data.buses,
        40,
        (id) => stopNames.get(id) ?? id,
        (code) => data.cancelReasons.find((r) => r.code === code)?.label ?? code,
      ),
      cancellations: cancellationStats(data.tokens, data.cancelReasons, data.dayStart),
      releaseLoadPct: configValue(data.config, "release_load_pct", 70),
    };
  }, [data, stopNames]);

  // Seats + standing of the route's buses (bus_capacity is the fallback for a route with none).
  const capacityOf = (code: string) => {
    const bus = data?.buses.find((b) => b.destination === code);
    return bus ? totalPlaces(bus) : (data?.destinations.find((d) => d.code === code)?.bus_capacity ?? 70);
  };
  const placesOf = (code: string) => dispatchPlaces(code, data?.buses ?? [], capacityOf(code));

  return (
    <div className="min-h-dvh">
      <DashboardHeader
        totals={derived?.totals ?? null}
        onRecompute={() => act("dispatch", () => runDispatch(getSupabase()))}
        recomputing={isPending("dispatch")}
        onResetDemo={() => act("reset-demo", () => resetDemo(getSupabase()))}
        resetting={isPending("reset-demo")}
        canDispatch={dispatcher}
        canAdminister={admin}
      />

      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-8">
        {error ? (
          <Banner tone="danger" title="Can't load live data">
            {error}
          </Banner>
        ) : null}
        {errors.dispatch ? (
          <Banner tone="danger" title="Recompute failed">
            {errors.dispatch}
          </Banner>
        ) : null}
        {errors["reset-demo"] ? (
          <Banner tone="danger" title="Reset failed">
            {errors["reset-demo"]}
          </Banner>
        ) : null}

        <section aria-label="Destinations" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {DESTINATIONS.map((d) =>
            data && derived ? (
              <DestinationCard
                key={d.code}
                code={d.code}
                name={d.name}
                capacity={capacityOf(d.code)}
                places={placesOf(d.code)}
                releaseLoadPct={derived.releaseLoadPct}
                summary={summarizeDestination(
                  d.code,
                  data.tokens,
                  placesOf(d.code),
                  derived.releaseLoadPct,
                  now,
                  servedStopsOf(d.code),
                )}
                buses={data.buses.filter((b) => b.destination === d.code)}
                pending={derived.pending[d.code]}
                actions={dispatcher ? actions : null}
              />
            ) : loading ? (
              <CardSkeleton key={d.code} />
            ) : null,
          )}
        </section>

        {routesError ? (
          <Banner tone="warn" title="Can't load routes for the map">
            {routesError}
          </Banner>
        ) : null}

        {data && now ? <LiveMap routes={routes} buses={data.buses} now={now} /> : null}

        {data && derived ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
            <ActivityFeed items={derived.activity} />
            <div className="space-y-6">
              <MethodBreakdown total={derived.methods.total} shares={derived.methods.shares} />
              <CancelReasons stats={derived.cancellations} />
              <ModelInsights rows={derived.insights} />
              <SettingsPanel
                rows={data.config}
                save={admin ? (key, value) => act(`config-${key}`, () => updateConfig(getSupabase(), key, value)) : undefined}
                isPending={isPending}
                errors={errors}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
