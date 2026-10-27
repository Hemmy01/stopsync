import { describe, expect, it } from "vitest";
import { createLineBuffer, formatCommand, parseBoardLine } from "@/lib/protocol";

describe("parseBoardLine", () => {
  it("parses HELLO", () => {
    expect(parseBoardLine("HELLO,STOP-01")).toEqual({
      ok: true,
      message: { type: "HELLO", stopId: "STOP-01" },
    });
  });

  it("parses STATE", () => {
    expect(parseBoardLine("STATE,LISTENING")).toEqual({
      ok: true,
      message: { type: "STATE", state: "LISTENING" },
    });
    expect(parseBoardLine("STATE,IDLE")).toEqual({
      ok: true,
      message: { type: "STATE", state: "IDLE" },
    });
  });

  it("parses SELECT for voice and gesture", () => {
    expect(parseBoardLine("SELECT,KIM,voice,0.91")).toEqual({
      ok: true,
      message: { type: "SELECT", code: "KIM", method: "voice", confidence: 0.91 },
    });
    expect(parseBoardLine("SELECT,DTN,gesture,0.88")).toEqual({
      ok: true,
      message: { type: "SELECT", code: "DTN", method: "gesture", confidence: 0.88 },
    });
  });

  it("tolerates CRLF, surrounding whitespace and method case", () => {
    expect(parseBoardLine("  SELECT, NYA ,Voice,1\r\n")).toEqual({
      ok: true,
      message: { type: "SELECT", code: "NYA", method: "voice", confidence: 1 },
    });
  });

  it.each([
    ["", "empty"],
    ["PING", "unknown type"],
    ["hello,STOP-01", "lowercase type"],
    ["HELLO", "missing stop id"],
    ["STATE,SLEEPING", "unknown state"],
    ["SELECT,XYZ,voice,0.9", "unknown destination"],
    ["SELECT,kim,voice,0.9", "lowercase destination"],
    ["SELECT,KIM,rfid,0.9", "board cannot send rfid"],
    ["SELECT,KIM,voice", "missing confidence"],
    ["SELECT,KIM,voice,", "blank confidence"],
    ["SELECT,KIM,voice,high", "non-numeric confidence"],
    ["SELECT,KIM,voice,1.5", "confidence above 1"],
    ["SELECT,KIM,voice,-0.1", "negative confidence"],
    ["SELECT,KIM,voice,0.9,extra", "too many fields"],
  ])("rejects %j (%s) without throwing", (line) => {
    const result = parseBoardLine(line);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBeTruthy();
  });
});

describe("formatCommand", () => {
  it("formats kiosk commands", () => {
    expect(formatCommand({ type: "START" })).toBe("START");
    expect(formatCommand({ type: "CANCEL" })).toBe("CANCEL");
    expect(formatCommand({ type: "ACK", code: "R3-014" })).toBe("ACK,R3-014");
  });
});

describe("createLineBuffer", () => {
  it("joins chunks and splits on newlines", () => {
    const buffer = createLineBuffer();
    expect(buffer.push("HELLO,ST")).toEqual([]);
    expect(buffer.push("OP-01\nSTATE,LIS")).toEqual(["HELLO,STOP-01"]);
    expect(buffer.push("TENING\r\nSELECT,KIM,voice,0.9\n")).toEqual([
      "STATE,LISTENING",
      "SELECT,KIM,voice,0.9",
    ]);
  });

  it("skips blank lines", () => {
    expect(createLineBuffer().push("\n\r\nHELLO,STOP-01\n\n")).toEqual(["HELLO,STOP-01"]);
  });

  it("drops a runaway line with no newline", () => {
    const buffer = createLineBuffer(10);
    buffer.push("x".repeat(20));
    expect(buffer.push("\nSTATE,IDLE\n")).toEqual(["STATE,IDLE"]);
  });
});
