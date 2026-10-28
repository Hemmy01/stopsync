"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Banner } from "@/components/Banner";
import { departureStatus, ticketStatusLine } from "@/lib/departures";
import { STEP_TIMEOUT_MS } from "@/lib/kiosk-machine";
import { STOP_ID } from "@/lib/supabase";
import type { SerialConnection } from "@/lib/use-board";
import { useKiosk } from "@/lib/use-kiosk";
import { useLiveNetwork } from "@/lib/use-live-network";
import { useStopName } from "@/lib/use-stop";
import { ConfirmStage } from "./ConfirmStage";
import { ConnectBoardControl } from "./ConnectBoardControl";
import { DebugDrawer } from "./DebugDrawer";
import { DepartureStrip } from "./DepartureStrip";
import { IdleStage } from "./IdleStage";
import { KioskTopBar } from "./KioskTopBar";
import { ListeningStage } from "./ListeningStage";
import { TicketStage } from "./TicketStage";

const noopSubscribe = () => () => {};

/** ?mock=1 in the URL. False during server render. */
function useUrlFlag(name: "mock"): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get(name) === "1",
    () => false,
  );
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

interface BoardBannersProps {
  supported: boolean;
  connection: SerialConnection;
  serialError: string | null;
  noHello: boolean;
  mockMode: boolean;
  onReconnect: () => void;
}

/** Board problems, always with the reassurance that tapping a stop still works. */
function BoardBanners({ supported, connection, serialError, noHello, mockMode, onReconnect }: BoardBannersProps) {
  if (serialError) {
    return (
      <Banner tone="danger" title="Board not connected" className="mb-6">
        {serialError} Passengers can still tap a stop on screen.
      </Banner>
    );
  }
  if (connection === "lost") {
    return (
      <Banner
        tone="warn"
        title="Board disconnected"
        className="mb-6"
        action={
          <button
            type="button"
            onClick={onReconnect}
            className="h-14 rounded-card bg-ink px-5 text-base font-semibold text-paper"
          >
            Reconnect
          </button>
        }
      >
        Voice and gesture are paused. It reconnects automatically when plugged back in; passengers can still tap a stop.
      </Banner>
    );
  }
  if (connection === "connected" && noHello) {
    return (
      <Banner tone="warn" title="The board isn't answering" className="mb-6">
        The port is open but the board hasn&apos;t said hello. Unplug it and plug it back in, or upload the
        kiosk firmware. Passengers can still tap a stop on screen.
      </Banner>
    );
  }
  if (!supported && !mockMode) {
    return (
      <Banner tone="info" title="This browser can't talk to the board" className="mb-6">
        Open the kiosk in Chrome or Edge on the laptop. Passengers can still tap a stop on screen.
      </Banner>
    );
  }
  return null;
}

export function KioskApp() {
  const mockParam = useUrlFlag("mock");
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
      <KioskTopBar
        stopName={stopName}
        boardStatus={board.status}
        actions={
          <ConnectBoardControl
            supported={board.serialSupported}
            connection={board.connection}
            onConnect={(arduinoOnly) => void board.connect(arduinoOnly)}
            onDisconnect={() => void board.disconnect()}
          />
        }
      />

      <main className="flex min-h-0 flex-1 flex-col px-10 py-8">
        <BoardBanners
          supported={board.serialSupported}
          connection={board.connection}
          serialError={board.serialError}
          noHello={board.noHello}
          mockMode={mockMode}
          onReconnect={() => void board.connect(true)}
        />

        {network.error ? (
          <Banner tone="danger" title="Can't reach Tap&Select right now" className="mb-6">
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
