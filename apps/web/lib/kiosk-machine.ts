// Kiosk passenger flow as a single typed reducer. Pure: side effects
// (board commands, RPC calls, timers) live in use-kiosk.ts.

import { isDestinationCode, type DestinationCode } from "./destinations";
import type { KioskCommand } from "./protocol";

export type SelectionMethod = "voice" | "gesture" | "manual";

export interface Selection {
  code: DestinationCode;
  method: SelectionMethod;
  /** 0–1 from the board; null when tapped on screen. */
  confidence: number | null;
}

export interface Ticket {
  code: string;
  destination: string;
  position: number;
}

export type KioskState =
  | { step: "idle" }
  | { step: "checking"; cardId: string }
  | { step: "listening"; cardId: string }
  /** A gesture was recognised: show it briefly ("→ Downtown") before asking to confirm. */
  | { step: "detected"; cardId: string; selection: Selection }
  | { step: "confirm"; cardId: string; selection: Selection; error?: string }
  | { step: "submitting"; cardId: string; selection: Selection }
  | { step: "ticket"; cardId: string; ticket: Ticket }
  | { step: "duplicate"; cardId: string; code: string; destination: string };

export type KioskStep = KioskState["step"];

export type KioskEvent =
  | { type: "CARD_TAPPED"; cardId: string }
  | { type: "CARD_CLEAR" }
  | { type: "CARD_ALREADY_QUEUED"; code: string; destination: string }
  | { type: "SELECTED"; selection: Selection }
  | { type: "DETECTED_SHOWN" }
  | { type: "CONFIRM" }
  | { type: "CHANGE" }
  | { type: "TOKEN_CREATED"; ticket: Ticket }
  | { type: "TOKEN_DUPLICATE"; code: string; destination: string }
  | { type: "TOKEN_FAILED"; message: string }
  | { type: "TIMEOUT" }
  | { type: "CANCEL" };

export const initialKioskState: KioskState = { step: "idle" };

/** How long each step waits before giving up (ms). */
export const STEP_TIMEOUT_MS: Partial<Record<KioskStep, number>> = {
  listening: 20_000,
  confirm: 15_000,
  ticket: 12_000,
  duplicate: 12_000,
};

/** How long the detected gesture stays on screen before the confirm step (ms). */
export const DETECTED_SHOW_MS = 1200;

/** Steps where a timeout or cancel must tell the board to stop listening. */
export function timeoutSendsCancel(step: KioskStep): boolean {
  return step === "listening" || step === "detected" || step === "confirm";
}

/** The board may only choose a destination while the kiosk is listening. */
export function acceptsBoardSelect(state: KioskState): boolean {
  return state.step === "listening";
}

/** Method chip text, e.g. "Heard by voice · 91%" or "Gesture · 88%". */
export function selectionLabel({ method, confidence }: Selection): string {
  const pct = confidence === null ? "" : ` · ${Math.round(confidence * 100)}%`;
  switch (method) {
    case "voice":
      return `Heard by voice${pct}`;
    case "gesture":
      return `Gesture${pct}`;
    case "manual":
      return "Tapped on screen";
  }
}

export function kioskReducer(state: KioskState, event: KioskEvent): KioskState {
  switch (event.type) {
    case "CARD_TAPPED":
      return state.step === "idle" ? { step: "checking", cardId: event.cardId } : state;

    case "CARD_CLEAR":
      return state.step === "checking" ? { step: "listening", cardId: state.cardId } : state;

    case "CARD_ALREADY_QUEUED":
      return state.step === "checking"
        ? { step: "duplicate", cardId: state.cardId, code: event.code, destination: event.destination }
        : state;

    case "SELECTED":
      if (state.step !== "listening" || !isDestinationCode(event.selection.code)) return state;
      return {
        step: event.selection.method === "gesture" ? "detected" : "confirm",
        cardId: state.cardId,
        selection: event.selection,
      };

    case "DETECTED_SHOWN":
      return state.step === "detected" ? { step: "confirm", cardId: state.cardId, selection: state.selection } : state;

    case "CONFIRM":
      return state.step === "confirm"
        ? { step: "submitting", cardId: state.cardId, selection: state.selection }
        : state;

    case "CHANGE":
      return state.step === "confirm" ? { step: "listening", cardId: state.cardId } : state;

    case "TOKEN_CREATED":
      return state.step === "submitting"
        ? { step: "ticket", cardId: state.cardId, ticket: event.ticket }
        : state;

    case "TOKEN_DUPLICATE":
      return state.step === "submitting"
        ? { step: "duplicate", cardId: state.cardId, code: event.code, destination: event.destination }
        : state;

    case "TOKEN_FAILED":
      return state.step === "submitting"
        ? { step: "confirm", cardId: state.cardId, selection: state.selection, error: event.message }
        : state;

    case "TIMEOUT":
      return STEP_TIMEOUT_MS[state.step] !== undefined ? initialKioskState : state;

    case "CANCEL":
      // Never abandon an in-flight request: its result decides the next step.
      return state.step === "submitting" ? state : initialKioskState;
  }
}

export type SelectionOutcome = "confirmed" | "changed" | "cancelled" | "timeout";

export interface TransitionEffects {
  /** Lines to send to the board, in order. */
  commands: KioskCommand[];
  /** A selection outcome to record with log_selection. */
  outcome?: { selection: Selection; outcome: SelectionOutcome; tokenCode: string | null };
}

/**
 * What a transition must do outside the reducer. Pure, so the board protocol
 * and the selection log are unit-tested with the state machine.
 */
export function transitionEffects(prev: KioskState, event: KioskEvent, next: KioskState): TransitionEffects {
  if (next === prev) return { commands: [] };

  switch (event.type) {
    case "CARD_CLEAR":
      return { commands: [{ type: "START" }] };

    case "CARD_ALREADY_QUEUED":
      return { commands: [{ type: "CANCEL" }] };

    case "CHANGE":
      // The board stopped after its SELECT: make it listen again.
      return prev.step === "confirm"
        ? { commands: [{ type: "START" }], outcome: { selection: prev.selection, outcome: "changed", tokenCode: null } }
        : { commands: [] };

    case "TOKEN_CREATED":
      return prev.step === "submitting"
        ? {
            commands: [{ type: "ACK", code: event.ticket.code }],
            outcome: { selection: prev.selection, outcome: "confirmed", tokenCode: event.ticket.code },
          }
        : { commands: [] };

    case "TOKEN_DUPLICATE":
      // The passenger confirmed the model's choice; the card was simply already queued.
      return prev.step === "submitting"
        ? {
            commands: [{ type: "CANCEL" }],
            outcome: { selection: prev.selection, outcome: "confirmed", tokenCode: event.code },
          }
        : { commands: [] };

    case "TIMEOUT":
    case "CANCEL": {
      const commands: KioskCommand[] = timeoutSendsCancel(prev.step) ? [{ type: "CANCEL" }] : [];
      if (prev.step !== "confirm" && prev.step !== "detected") return { commands };
      const outcome = event.type === "TIMEOUT" ? "timeout" : "cancelled";
      return { commands, outcome: { selection: prev.selection, outcome, tokenCode: null } };
    }

    default:
      return { commands: [] };
  }
}
