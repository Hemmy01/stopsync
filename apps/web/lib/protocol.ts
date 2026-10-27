// Board <-> kiosk serial protocol. Pure: no I/O. See docs/protocol.md.
//
// One message per line, "\n" terminated, comma-separated, uppercase type.

import { isDestinationCode, type DestinationCode } from "./destinations";

export const BAUD_RATE = 115_200;
export const ARDUINO_USB_VENDOR_ID = 0x2341;

export type BoardMethod = "voice" | "gesture";

export type BoardMessage =
  | { type: "HELLO"; stopId: string }
  | { type: "STATE"; state: "LISTENING" | "IDLE" }
  | { type: "SELECT"; code: DestinationCode; method: BoardMethod; confidence: number }
  /** Diagnostics only: shown in the debug drawer, never acted on. */
  | { type: "LOG"; text: string };

export type KioskCommand = { type: "START" } | { type: "ACK"; code: string } | { type: "CANCEL" };

export type ParseResult =
  | { ok: true; message: BoardMessage }
  | { ok: false; reason: string };

const fail = (reason: string): ParseResult => ({ ok: false, reason });

/** Parse one line from the board. Never throws. */
export function parseBoardLine(raw: string): ParseResult {
  const line = raw.trim();
  if (line === "") return fail("Empty line");

  // LOG text is free-form and may itself contain commas.
  if (line === "LOG" || line.startsWith("LOG,")) {
    return { ok: true, message: { type: "LOG", text: line.slice(4).trim() } };
  }

  const [type, ...args] = line.split(",").map((part) => part.trim());

  switch (type) {
    case "HELLO": {
      if (args.length !== 1 || args[0] === "") return fail("HELLO needs a stop id");
      return { ok: true, message: { type: "HELLO", stopId: args[0] } };
    }

    case "STATE": {
      const state = args[0];
      if (args.length !== 1 || (state !== "LISTENING" && state !== "IDLE")) {
        return fail("STATE must be LISTENING or IDLE");
      }
      return { ok: true, message: { type: "STATE", state } };
    }

    case "SELECT": {
      if (args.length !== 3) return fail("SELECT needs code, method and confidence");
      const [code, rawMethod, rawConfidence] = args;
      if (!isDestinationCode(code)) return fail(`Unknown destination code "${code}"`);

      const method = rawMethod.toLowerCase();
      if (method !== "voice" && method !== "gesture") {
        return fail(`Method must be voice or gesture, got "${rawMethod}"`);
      }

      const confidence = Number(rawConfidence);
      if (rawConfidence === "" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        return fail(`Confidence must be a number from 0 to 1, got "${rawConfidence}"`);
      }

      return { ok: true, message: { type: "SELECT", code, method, confidence } };
    }

    default:
      return fail(`Unknown message type "${type}"`);
  }
}

/** Serialise a kiosk command (without the trailing newline). */
export function formatCommand(command: KioskCommand): string {
  switch (command.type) {
    case "START":
      return "START";
    case "CANCEL":
      return "CANCEL";
    case "ACK":
      return `ACK,${command.code}`;
  }
}

/**
 * Splits a stream of text chunks into complete lines. Serial reads arrive in
 * arbitrary pieces, so partial lines are held until their "\n" arrives.
 */
export function createLineBuffer(maxLength = 512) {
  let pending = "";
  return {
    push(chunk: string): string[] {
      pending += chunk;
      const parts = pending.split(/\r?\n/);
      pending = parts.pop() ?? "";
      // A board that never sends "\n" must not grow memory forever.
      if (pending.length > maxLength) pending = "";
      return parts.filter((line) => line.trim() !== "");
    },
    reset() {
      pending = "";
    },
  };
}
