import { describe, expect, it } from "vitest";
import {
  acceptsBoardSelect,
  initialKioskState,
  kioskReducer,
  selectionLabel,
  timeoutSendsCancel,
  transitionEffects,
  type KioskEvent,
  type KioskState,
  type Selection,
} from "@/lib/kiosk-machine";

const voiceKim: Selection = { code: "KIM", method: "voice", confidence: 0.91 };
const ticket = { code: "R3-014", destination: "KIM", position: 3 };

function run(...events: KioskEvent[]): KioskState {
  return events.reduce(kioskReducer, initialKioskState);
}

const listening = (): KioskState =>
  run({ type: "CARD_TAPPED", cardId: "CARD-01" }, { type: "CARD_CLEAR" });

const confirming = (): KioskState => kioskReducer(listening(), { type: "SELECTED", selection: voiceKim });

describe("kioskReducer: happy path", () => {
  it("idle → checking → listening → confirm → submitting → ticket", () => {
    let state = kioskReducer(initialKioskState, { type: "CARD_TAPPED", cardId: "CARD-01" });
    expect(state).toEqual({ step: "checking", cardId: "CARD-01" });

    state = kioskReducer(state, { type: "CARD_CLEAR" });
    expect(state).toEqual({ step: "listening", cardId: "CARD-01" });

    state = kioskReducer(state, { type: "SELECTED", selection: voiceKim });
    expect(state).toEqual({ step: "confirm", cardId: "CARD-01", selection: voiceKim });

    state = kioskReducer(state, { type: "CONFIRM" });
    expect(state).toEqual({ step: "submitting", cardId: "CARD-01", selection: voiceKim });

    state = kioskReducer(state, { type: "TOKEN_CREATED", ticket });
    expect(state).toEqual({ step: "ticket", cardId: "CARD-01", ticket });

    expect(kioskReducer(state, { type: "TIMEOUT" })).toEqual(initialKioskState);
  });

  it("supports a manual tap selection", () => {
    const manual: Selection = { code: "NYA", method: "manual", confidence: null };
    expect(kioskReducer(listening(), { type: "SELECTED", selection: manual })).toMatchObject({
      step: "confirm",
      selection: manual,
    });
  });
});

describe("kioskReducer: duplicates", () => {
  it("shows the existing ticket when the card is already queued at tap time", () => {
    const state = run(
      { type: "CARD_TAPPED", cardId: "CARD-02" },
      { type: "CARD_ALREADY_QUEUED", code: "R1-004", destination: "NYA" },
    );
    expect(state).toEqual({ step: "duplicate", cardId: "CARD-02", code: "R1-004", destination: "NYA" });
  });

  it("shows the existing ticket when create_token reports a duplicate", () => {
    const state = [
      { type: "CONFIRM" },
      { type: "TOKEN_DUPLICATE", code: "R3-002", destination: "KIM" },
    ].reduce((s, e) => kioskReducer(s, e as KioskEvent), confirming());
    expect(state).toMatchObject({ step: "duplicate", code: "R3-002" });
  });
});

describe("kioskReducer: guards", () => {
  it("ignores board selections outside the listening step", () => {
    const select: KioskEvent = { type: "SELECTED", selection: voiceKim };
    expect(kioskReducer(initialKioskState, select)).toBe(initialKioskState);

    const confirm = confirming();
    const other: KioskEvent = { type: "SELECTED", selection: { ...voiceKim, code: "REM" } };
    expect(kioskReducer(confirm, other)).toBe(confirm);
  });

  it("ignores unknown destination codes", () => {
    const state = listening();
    const bogus = { type: "SELECTED", selection: { code: "XXX", method: "voice", confidence: 1 } };
    expect(kioskReducer(state, bogus as unknown as KioskEvent)).toBe(state);
  });

  it("ignores a second tap while a card is in progress", () => {
    const state = listening();
    expect(kioskReducer(state, { type: "CARD_TAPPED", cardId: "CARD-03" })).toBe(state);
  });

  it("never double-submits", () => {
    const submitting = kioskReducer(confirming(), { type: "CONFIRM" });
    expect(kioskReducer(submitting, { type: "CONFIRM" })).toBe(submitting);
  });

  it("does not cancel or time out while submitting", () => {
    const submitting = kioskReducer(confirming(), { type: "CONFIRM" });
    expect(kioskReducer(submitting, { type: "CANCEL" })).toBe(submitting);
    expect(kioskReducer(submitting, { type: "TIMEOUT" })).toBe(submitting);
  });

  it("returns to confirm with an error when the request fails", () => {
    const submitting = kioskReducer(confirming(), { type: "CONFIRM" });
    expect(kioskReducer(submitting, { type: "TOKEN_FAILED", message: "Network error" })).toEqual({
      step: "confirm",
      cardId: "CARD-01",
      selection: voiceKim,
      error: "Network error",
    });
  });
});

describe("kioskReducer: change, cancel and timeouts", () => {
  it("Change goes back to listening", () => {
    expect(kioskReducer(confirming(), { type: "CHANGE" })).toEqual({ step: "listening", cardId: "CARD-01" });
  });

  it("times out listening and confirm back to idle", () => {
    expect(kioskReducer(listening(), { type: "TIMEOUT" })).toEqual(initialKioskState);
    expect(kioskReducer(confirming(), { type: "TIMEOUT" })).toEqual(initialKioskState);
  });

  it("does not time out idle or checking", () => {
    const checking = run({ type: "CARD_TAPPED", cardId: "CARD-01" });
    expect(kioskReducer(initialKioskState, { type: "TIMEOUT" })).toBe(initialKioskState);
    expect(kioskReducer(checking, { type: "TIMEOUT" })).toBe(checking);
  });

  it("cancel returns to idle", () => {
    expect(kioskReducer(listening(), { type: "CANCEL" })).toEqual(initialKioskState);
    expect(kioskReducer(confirming(), { type: "CANCEL" })).toEqual(initialKioskState);
  });
});

describe("helpers", () => {
  it("only accepts board selections while listening", () => {
    expect(acceptsBoardSelect(listening())).toBe(true);
    expect(acceptsBoardSelect(initialKioskState)).toBe(false);
    expect(acceptsBoardSelect(confirming())).toBe(false);
  });

  it("labels the selection method", () => {
    expect(selectionLabel(voiceKim)).toBe("Heard by voice · 91%");
    expect(selectionLabel({ code: "KIM", method: "gesture", confidence: 0.875 })).toBe("Gesture · 88%");
    expect(selectionLabel({ code: "KIM", method: "manual", confidence: null })).toBe("Tapped on screen");
  });

  it("sends CANCEL to the board only when it may still be listening", () => {
    expect(timeoutSendsCancel("listening")).toBe(true);
    expect(timeoutSendsCancel("confirm")).toBe(true);
    expect(timeoutSendsCancel("ticket")).toBe(false);
    expect(timeoutSendsCancel("duplicate")).toBe(false);
  });
});

describe("transitionEffects", () => {
  const voice: Selection = { code: "DTN", method: "voice", confidence: 0.9 };
  const confirmState: KioskState = { step: "confirm", cardId: "CARD-01", selection: voice };
  const submitting: KioskState = { step: "submitting", cardId: "CARD-01", selection: voice };

  const run = (prev: KioskState, event: KioskEvent) =>
    transitionEffects(prev, event, kioskReducer(prev, event));

  it("sends START when the card is clear", () => {
    expect(run({ step: "checking", cardId: "CARD-01" }, { type: "CARD_CLEAR" })).toEqual({
      commands: [{ type: "START" }],
    });
  });

  it("sends CANCEL when the card is already queued", () => {
    expect(
      run({ step: "checking", cardId: "CARD-01" }, { type: "CARD_ALREADY_QUEUED", code: "R4-001", destination: "DTN" })
        .commands,
    ).toEqual([{ type: "CANCEL" }]);
  });

  it("Change sends START again and logs 'changed'", () => {
    expect(run(confirmState, { type: "CHANGE" })).toEqual({
      commands: [{ type: "START" }],
      outcome: { selection: voice, outcome: "changed", tokenCode: null },
    });
  });

  it("a created token sends ACK and logs 'confirmed' with the code", () => {
    const ticket = { code: "R4-002", destination: "DTN", position: 2 };
    expect(run(submitting, { type: "TOKEN_CREATED", ticket })).toEqual({
      commands: [{ type: "ACK", code: "R4-002" }],
      outcome: { selection: voice, outcome: "confirmed", tokenCode: "R4-002" },
    });
  });

  it("a duplicate on submit sends CANCEL", () => {
    expect(run(submitting, { type: "TOKEN_DUPLICATE", code: "R4-001", destination: "DTN" }).commands).toEqual([
      { type: "CANCEL" },
    ]);
  });

  it("timeout and cancel on confirm send CANCEL and log the outcome", () => {
    expect(run(confirmState, { type: "TIMEOUT" })).toEqual({
      commands: [{ type: "CANCEL" }],
      outcome: { selection: voice, outcome: "timeout", tokenCode: null },
    });
    expect(run(confirmState, { type: "CANCEL" }).outcome?.outcome).toBe("cancelled");
  });

  it("listening timeout sends CANCEL with nothing to log", () => {
    expect(run({ step: "listening", cardId: "CARD-01" }, { type: "TIMEOUT" })).toEqual({
      commands: [{ type: "CANCEL" }],
    });
  });

  it("ticket timeout and ignored events do nothing", () => {
    const ticket: KioskState = { step: "ticket", cardId: "CARD-01", ticket: { code: "R4-002", destination: "DTN", position: 1 } };
    expect(run(ticket, { type: "TIMEOUT" })).toEqual({ commands: [] });
    expect(run({ step: "idle" }, { type: "CHANGE" })).toEqual({ commands: [] });
    expect(run(confirmState, { type: "CARD_CLEAR" })).toEqual({ commands: [] });
  });
});
