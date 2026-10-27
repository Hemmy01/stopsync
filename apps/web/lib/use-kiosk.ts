"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { DestinationCode } from "./destinations";
import {
  acceptsBoardSelect,
  initialKioskState,
  kioskReducer,
  STEP_TIMEOUT_MS,
  transitionEffects,
  type KioskEvent,
  type KioskState,
} from "./kiosk-machine";
import type { BoardMessage, KioskCommand } from "./protocol";
import { createToken, findWaitingToken, logSelection } from "./rpc";
import { getSupabase, STOP_ID } from "./supabase";
import { useBoard } from "./use-board";

const CARD_LOOKUP_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timed out")), ms)),
  ]);
}

/** Kiosk flow: the reducer plus its side effects (board commands, RPCs, timers). */
export function useKiosk({ mockMode }: { mockMode: boolean }) {
  const [state, dispatch] = useReducer(kioskReducer, initialKioskState);
  // Mirrors the reducer synchronously so handlers always see the latest step.
  const stateRef = useRef<KioskState>(state);
  const busy = useRef(false);
  // The board is created after transition(), so commands go through a ref.
  const sendRef = useRef<(command: KioskCommand) => void>(() => {});

  /** Run one event through the reducer, then its board commands and selection log. */
  const transition = useCallback((event: KioskEvent) => {
    const prev = stateRef.current;
    const next = kioskReducer(prev, event);
    stateRef.current = next;
    dispatch(event);

    const effects = transitionEffects(prev, event, next);
    for (const command of effects.commands) sendRef.current(command);
    if (effects.outcome) {
      const { selection, outcome, tokenCode } = effects.outcome;
      void logSelection(getSupabase(), {
        stopId: STOP_ID,
        destination: selection.code,
        method: selection.method,
        confidence: selection.confidence,
        outcome,
        tokenCode,
      }).catch(() => {
        // Analytics only: never block a passenger on it.
      });
    }
  }, []);

  const handleBoardMessage = useCallback(
    (message: BoardMessage) => {
      if (message.type !== "SELECT") return;
      if (!acceptsBoardSelect(stateRef.current)) return "kiosk is not listening";
      transition({
        type: "SELECTED",
        selection: { code: message.code, method: message.method, confidence: message.confidence },
      });
    },
    [transition],
  );

  const board = useBoard({ mockMode, onMessage: handleBoardMessage });
  const { send } = board;
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Step timeouts. Every transition creates a new state object, so the timer
  // restarts on each step (including Change → listening again).
  useEffect(() => {
    const ms = STEP_TIMEOUT_MS[state.step];
    if (ms === undefined) return;
    const id = setTimeout(() => transition({ type: "TIMEOUT" }), ms);
    return () => clearTimeout(id);
  }, [state, transition]);

  const tapCard = useCallback(
    async (cardId: string) => {
      if (stateRef.current.step !== "idle" || busy.current) return;
      busy.current = true;
      transition({ type: "CARD_TAPPED", cardId });

      let existing: Awaited<ReturnType<typeof findWaitingToken>> = null;
      try {
        existing = await withTimeout(findWaitingToken(getSupabase(), cardId), CARD_LOOKUP_TIMEOUT_MS);
      } catch {
        // Lookup failed: carry on. create_token still rejects duplicates.
      }
      busy.current = false;

      transition(existing ? { type: "CARD_ALREADY_QUEUED", ...existing } : { type: "CARD_CLEAR" });
    },
    [transition],
  );

  const selectManually = useCallback(
    (code: DestinationCode) => transition({ type: "SELECTED", selection: { code, method: "manual", confidence: null } }),
    [transition],
  );

  const confirm = useCallback(async () => {
    const current = stateRef.current;
    if (current.step !== "confirm" || busy.current) return;
    busy.current = true;
    transition({ type: "CONFIRM" });

    const { selection, cardId } = current;
    let result: Awaited<ReturnType<typeof createToken>>;
    try {
      result = await createToken(getSupabase(), {
        stopId: STOP_ID,
        destination: selection.code,
        cardId,
        method: selection.method,
        confidence: selection.confidence,
      });
    } catch (err) {
      result = { status: "error", message: err instanceof Error ? err.message : "Network error" };
    }
    busy.current = false;

    switch (result.status) {
      case "created":
        transition({
          type: "TOKEN_CREATED",
          ticket: { code: result.code, destination: result.destination, position: result.position },
        });
        break;
      case "duplicate":
        transition({ type: "TOKEN_DUPLICATE", code: result.code, destination: result.destination });
        break;
      case "error":
        transition({ type: "TOKEN_FAILED", message: result.message });
        break;
    }
  }, [transition]);

  const change = useCallback(() => transition({ type: "CHANGE" }), [transition]);
  const cancel = useCallback(() => transition({ type: "CANCEL" }), [transition]);

  return { state, board, tapCard, selectManually, confirm, change, cancel };
}
