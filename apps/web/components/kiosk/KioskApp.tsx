"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Banner } from "@/components/Banner";
import { departureStatus, ticketStatusLine } from "@/lib/departures";
import { STEP_TIMEOUT_MS } from "@/lib/kiosk-machine";
import { STOP_ID } from "@/lib/supabase";
import { useKiosk } from "@/lib/use-kiosk";
import { useLiveNetwork } from "@/lib/use-live-network";
import { useStopName } from "@/lib/use-stop";
import { ConfirmStage } from "./ConfirmStage";
import { DebugDrawer } from "./DebugDrawer";
import { DepartureStrip } from "./DepartureStrip";
import { IdleStage } from "./IdleStage";
import { KioskTopBar } from "./KioskTopBar";
import { ListeningStage } from "./ListeningStage";
import { TicketStage } from "./TicketStage";

const noopSubscribe = () => () => {};

/** ?mock=1 in the URL. False during server render. */
function useMockParam(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("mock") === "1",
    () => false,
  );
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function KioskApp() {
  const mockParam = useMockParam();
  // null = follow the URL; true/false once toggled with D.
  const [drawerToggle, setDrawerToggle] = useState<boolean | null>(null);
  const drawerOpen = drawerToggle ?? mockParam;
  const mockMode = mockParam || drawerOpen;

  const { state, board, tapCard, selectManually, confirm, change, cancel } = useKiosk({ mockMode });
  const network = useLiveNetwork();
  const stopName = useStopName(STOP_ID);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "d" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      setDrawerToggle((open) => !(open ?? mockParam));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mockParam]);

  const ticketProps = (destination: string) => {
    const status = departureStatus(destination, network.buses);
    return { destination, status, statusLine: ticketStatusLine(status) };
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-[20px]">
      <KioskTopBar stopName={stopName} boardStatus={board.status} />

      <main className="flex min-h-0 flex-1 flex-col px-10 py-8">
        {network.error ? (
          <Banner tone="danger" title="Can't reach StopSync right now" className="mb-6">
            {network.error} You can still tap a stop; numbers will be issued when the connection returns.
          </Banner>
        ) : null}

        <div className="min-h-0 flex-1">
          {(state.step === "idle" || state.step === "checking") && (
            <IdleStage reading={state.step === "checking"} onTap={tapCard} />
          )}

          {state.step === "listening" && <ListeningStage onSelect={selectManually} onCancel={cancel} />}

          {(state.step === "confirm" || state.step === "submitting") && (
            <ConfirmStage
              selection={state.selection}
              submitting={state.step === "submitting"}
              error={state.step === "confirm" ? state.error : undefined}
              onConfirm={confirm}
              onChange={change}
            />
          )}

          {state.step === "ticket" && (
            <TicketStage
              key={state.ticket.code}
              heading="Here's your number"
              subheading="Watch this screen or the board below for your bus."
              code={state.ticket.code}
              position={state.ticket.position}
              {...ticketProps(state.ticket.destination)}
              timeoutMs={STEP_TIMEOUT_MS.ticket ?? 12_000}
              onDone={cancel}
            />
          )}

          {state.step === "duplicate" && (
            <TicketStage
              key={state.code}
              heading="You're already in the queue"
              subheading="One ticket per card. Here's the one you have."
              code={state.code}
              {...ticketProps(state.destination)}
              timeoutMs={STEP_TIMEOUT_MS.duplicate ?? 12_000}
              onDone={cancel}
            />
          )}
        </div>
      </main>

      <DepartureStrip buses={network.buses} waiting={network.waiting} loading={network.loading} />

      {drawerOpen ? <DebugDrawer mock={board.mock} log={board.log} onClose={() => setDrawerToggle(false)} /> : null}
    </div>
  );
}
