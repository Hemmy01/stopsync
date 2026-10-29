"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Banner } from "@/components/Banner";
import { boardingAnnouncement, boardingKey, ticketAnnouncement } from "@/lib/announce";
import { getDestination } from "@/lib/destinations";
import { boardingNow, findTicket, queuePosition, ticketStatus, type Boarding } from "@/lib/queue";
import { trackBusFor } from "@/lib/routes";
import { STEP_TIMEOUT_MS } from "@/lib/kiosk-machine";
import { STOP_ID } from "@/lib/supabase";
import type { SerialConnection } from "@/lib/use-board";
import { useAnnouncer } from "@/lib/use-announcer";
import { useKiosk } from "@/lib/use-kiosk";
import { useCancelReasons } from "@/lib/use-cancel-reasons";
import { useLiveNetwork } from "@/lib/use-live-network";
import { useRoutes } from "@/lib/use-routes";
import { useStopName } from "@/lib/use-stop";
import { KioskTextProvider, useKioskText } from "@/lib/use-kiosk-text";
import { ConfirmStage } from "./ConfirmStage";
import { ConnectBoardControl } from "./ConnectBoardControl";
import { DebugDrawer } from "./DebugDrawer";
import { DepartureStrip } from "./DepartureStrip";
import { DetectedStage } from "./DetectedStage";
import { IdleStage } from "./IdleStage";
import { KioskTopBar } from "./KioskTopBar";
import { ListeningStage } from "./ListeningStage";
import { NowBoarding } from "./NowBoarding";
import { RouteStrip } from "./RouteStrip";
import { SoundToggle } from "./SoundToggle";
import { CancelConfirmStage, CancelledStage, CancelReasonStage } from "./CancelStages";
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

const destinationName = (code: string) => getDestination(code)?.name ?? code;

/**
 * Reads out each new ticket once, and each new boarding call once. Calls already on the board
 * when the kiosk opens are not read out.
 */
function useAnnouncements(
  ticket: { code: string; destination: string } | null,
  boardings: readonly Boarding[],
  loading: boolean,
  say: (text: string) => void,
) {
  const spokenTicket = useRef<string | null>(null);
  const seenBoardings = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ticket || spokenTicket.current === ticket.code) return;
    spokenTicket.current = ticket.code;
    say(ticketAnnouncement(ticket.code, destinationName(ticket.destination)));
  }, [ticket, say]);

  useEffect(() => {
    if (loading) return;
    const keys = boardings.map(boardingKey);
    if (seenBoardings.current === null) {
      seenBoardings.current = new Set(keys);
      return;
    }
    for (const b of boardings) {
      const key = boardingKey(b);
      if (seenBoardings.current.has(key)) continue;
      seenBoardings.current.add(key);
      say(boardingAnnouncement(b.busId, destinationName(b.destination), b.firstCode, b.lastCode));
    }
  }, [boardings, loading, say]);
}

export function KioskApp() {
  return (
    <KioskTextProvider>
      <KioskScreen />
    </KioskTextProvider>
  );
}

function KioskScreen() {
  const { t } = useKioskText();
  const mockParam = useUrlFlag("mock");
  // null = follow the URL; true/false once toggled with D.
  const [drawerToggle, setDrawerToggle] = useState<boolean | null>(null);
  const drawerOpen = drawerToggle ?? mockParam;
  const mockMode = mockParam || drawerOpen;

  const {
    state,
    board,
    gestureMode,
    liveGesture,
    tapCard,
    selectManually,
    confirm,
    change,
    cancel,
    startCancel,
    chooseReason,
    keepPlace,
    confirmCancel,
  } = useKiosk({ mockMode });
  const cancelReasons = useCancelReasons();
  const reasonLabel = (code: string) => t.reason(cancelReasons.reasons.find((r) => r.code === code) ?? { code, label: code });
  const network = useLiveNetwork();
  const { routes } = useRoutes();
  const stopName = useStopName(STOP_ID);
  const boardings = boardingNow(network.buses, network.tokens);
  const announcer = useAnnouncer({ hold: state.step === "listening" || state.step === "detected" });
  useAnnouncements(state.step === "ticket" ? state.ticket : null, boardings, network.loading, announcer.say);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "d" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      setDrawerToggle((open) => !(open ?? mockParam));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mockParam]);

  // Live: the ticket's place in the queue and whether its bus has called it.
  const ticketProps = (code: string, destination: string, positionAtCreation?: number) => {
    const ticket = findTicket(network.tokens, code);
    const position = ticket ? queuePosition(network.tokens, ticket) : (positionAtCreation ?? null);
    const status = ticketStatus(ticket, destination, network.buses, position);
    const tracked = status.kind === "on_the_way" ? trackBusFor(destination, network.buses, routes, t.progress) : null;
    const below = tracked ? (
      <RouteStrip
        route={tracked.route}
        progress={tracked.progress}
        color={getDestination(destination)?.color ?? "var(--ink)"}
        busId={tracked.bus.id}
        caption={tracked.line}
      />
    ) : null;
    return { destination, status, position: position ?? undefined, below };
  };

  return (
    <div lang={t.htmlLang} className="flex h-dvh flex-col overflow-hidden text-[20px]">
      <KioskTopBar
        stopName={stopName}
        boardStatus={board.status}
        sound={announcer.supported ? <SoundToggle on={announcer.soundOn} onChange={announcer.setSoundOn} /> : null}
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
          <Banner tone="danger" title={t.offlineTitle} className="mb-6">
            {network.error} {t.offlineHint}
          </Banner>
        ) : null}

        <div className="min-h-0 flex-1">
          {(state.step === "idle" || state.step === "checking") && (
            <IdleStage reading={state.step === "checking"} gestureMode={gestureMode} onTap={tapCard} />
          )}

          {state.step === "listening" && (
            <ListeningStage
              gestureMode={gestureMode}
              liveGesture={liveGesture}
              onSelect={selectManually}
              onCancel={cancel}
            />
          )}

          {state.step === "detected" && <DetectedStage selection={state.selection} gestureMode={gestureMode} />}

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
              heading={t.hereIsYourNumber}
              subheading={t.watchScreen}
              code={state.ticket.code}
              {...ticketProps(state.ticket.code, state.ticket.destination, state.ticket.position)}
              timeoutMs={STEP_TIMEOUT_MS.ticket ?? 12_000}
              onDone={cancel}
            />
          )}

          {state.step === "duplicate" && (
            <TicketStage
              key={state.code}
              heading={t.alreadyQueued}
              subheading={t.oneTicketPerCard}
              code={state.code}
              {...ticketProps(state.code, state.destination)}
              timeoutMs={STEP_TIMEOUT_MS.duplicate ?? 20_000}
              onDone={cancel}
              onCancelPlace={findTicket(network.tokens, state.code)?.status === "boarded" ? undefined : startCancel}
            />
          )}

          {state.step === "cancel_reason" && (
            <CancelReasonStage
              code={state.code}
              destination={state.destination}
              reasons={cancelReasons.reasons}
              error={cancelReasons.error}
              onChoose={chooseReason}
              onKeep={keepPlace}
            />
          )}

          {(state.step === "cancel_confirm" || state.step === "cancelling") && (
            <CancelConfirmStage
              code={state.code}
              destination={state.destination}
              reasonLabel={reasonLabel(state.reason)}
              pending={state.step === "cancelling"}
              error={state.step === "cancel_confirm" ? state.error : undefined}
              onConfirm={confirmCancel}
              onKeep={keepPlace}
            />
          )}

          {state.step === "cancelled" && (
            <CancelledStage code={state.code} destination={state.destination} onDone={cancel} />
          )}
        </div>
      </main>

      <NowBoarding boardings={boardings} />
      <DepartureStrip buses={network.buses} waiting={network.waiting} loading={network.loading} />

      {drawerOpen ? <DebugDrawer mock={board.mock} log={board.log} onClose={() => setDrawerToggle(false)} /> : null}
    </div>
  );
}
