"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { DestinationCode } from "./destinations";
import {
  acceptsBoardSelect,
  initialKioskState,
  kioskReducer,
  STEP_TIMEOUT_MS,
  timeoutSendsCancel,
  type KioskState,
} from "./kiosk-machine";
import type { BoardMessage } from "./protocol";
import { createToken, findWaitingToken } from "./rpc";
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

  const stateRef = useRef<KioskState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const busy = useRef(false);

  const handleBoardMessage = useCallback((message: BoardMessage) => {
    if (message.type !== "SELECT") return;
    if (!acceptsBoardSelect(stateRef.current)) return "kiosk is not listening";
    dispatch({
      type: "SELECTED",
      selection: { code: message.code, method: message.method, confidence: message.confidence },
    });
  }, []);

  const board = useBoard({ mockMode, onMessage: handleBoardMessage });
  const { send } = board;

  // Step timeouts. Every transition creates a new state object, so the timer
  // restarts on each step (including Change → listening again).
  useEffect(() => {
    const ms = STEP_TIMEOUT_MS[state.step];
    if (ms === undefined) return;
    const id = setTimeout(() => {
      if (timeoutSendsCancel(state.step)) send({ type: "CANCEL" });
      dispatch({ type: "TIMEOUT" });
    }, ms);
    return () => clearTimeout(id);
  }, [state, send]);

  const tapCard = useCallback(
    async (cardId: string) => {
      if (stateRef.current.step !== "idle" || busy.current) return;
      busy.current = true;
      dispatch({ type: "CARD_TAPPED", cardId });

      let existing: Awaited<ReturnType<typeof findWaitingToken>> = null;
      try {
        existing = await withTimeout(findWaitingToken(getSupabase(), cardId), CARD_LOOKUP_TIMEOUT_MS);
      } catch {
        // Lookup failed: carry on. create_token still rejects duplicates.
      }
      busy.current = false;

      if (existing) {
        dispatch({ type: "CARD_ALREADY_QUEUED", ...existing });
      } else {
        dispatch({ type: "CARD_CLEAR" });
        send({ type: "START" });
      }
    },
    [send],
  );

  const selectManually = useCallback((code: DestinationCode) => {
    dispatch({ type: "SELECTED", selection: { code, method: "manual", confidence: null } });
  }, []);

  const confirm = useCallback(async () => {
    const current = stateRef.current;
    if (current.step !== "confirm" || busy.current) return;
    busy.current = true;
    dispatch({ type: "CONFIRM" });

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
        dispatch({
          type: "TOKEN_CREATED",
          ticket: { code: result.code, destination: result.destination, position: result.position },
        });
        send({ type: "ACK", code: result.code });
        break;
      case "duplicate":
        dispatch({ type: "TOKEN_DUPLICATE", code: result.code, destination: result.destination });
        send({ type: "CANCEL" });
        break;
      case "error":
        dispatch({ type: "TOKEN_FAILED", message: result.message });
        break;
    }
  }, [send]);

  const change = useCallback(() => {
    if (stateRef.current.step !== "confirm") return;
    dispatch({ type: "CHANGE" });
    send({ type: "START" });
  }, [send]);

  const cancel = useCallback(() => {
    const { step } = stateRef.current;
    if (step === "submitting") return;
    if (timeoutSendsCancel(step)) send({ type: "CANCEL" });
    dispatch({ type: "CANCEL" });
  }, [send]);

  return { state, board, tapCard, selectManually, confirm, change, cancel };
}
