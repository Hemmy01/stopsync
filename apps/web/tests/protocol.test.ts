import { describe, expect, it } from "vitest";
import { createLineBuffer, formatCommand, parseBoardLine, parseScores } from "@/lib/protocol";

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

  it("parses LOG with free-form text, commas included", () => {
    expect(parseBoardLine("LOG,voice=model,gesture=rule,fw=0.2.0")).toEqual({
      ok: true,
      message: { type: "LOG", text: "voice=model,gesture=rule,fw=0.2.0" },
    });
    expect(parseBoardLine("LOG,voice_overrun")).toEqual({ ok: true, message: { type: "LOG", text: "voice_overrun" } });
    expect(parseBoardLine("LOG")).toEqual({ ok: true, message: { type: "LOG", text: "" } });
    expect(parseBoardLine("LOGGING,x").ok).toBe(false);
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

describe("parseScores", () => {
  const line = "LOG,scores,downtown=0.02,kimironko=0.01,noise=0.03,nyabugogo=0.00,remera=0.93,unknown=0.01";

  it("reads every label from a LOG,scores line", () => {
    const parsed = parseBoardLine(line);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || parsed.message.type !== "LOG") throw new Error("expected LOG");
    expect(parseScores(parsed.message.text)).toEqual([
      { label: "downtown", value: 0.02 },
      { label: "kimironko", value: 0.01 },
      { label: "noise", value: 0.03 },
      { label: "nyabugogo", value: 0 },
      { label: "remera", value: 0.93 },
      { label: "unknown", value: 0.01 },
    ]);
  });

  it.each([
    ["voice=model,gesture=rule,fw=0.2.0", "not a scores line"],
    ["scores", "no pairs"],
    ["scores,remera", "missing value"],
    ["scores,remera=", "blank value"],
    ["scores,remera=high", "non-numeric value"],
    ["scores,=0.5", "missing label"],
    ["scores,remera=0.5=1", "two equals signs"],
  ])("returns null for %j (%s)", (text) => {
    expect(parseScores(text)).toBeNull();
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

  it("splits several lines that arrive in one chunk", () => {
    expect(
      createLineBuffer().push("HELLO,STOP-01\r\nLOG,voice=model,gesture=rule,fw=0.2.0\r\nSTATE,LISTENING\r\n"),
    ).toEqual(["HELLO,STOP-01", "LOG,voice=model,gesture=rule,fw=0.2.0", "STATE,LISTENING"]);
  });

  it("holds a line split across many chunks, even mid CRLF", () => {
    const buffer = createLineBuffer();
    const line = "LOG,scores,downtown=0.02,remera=0.93\r\n";
    const out: string[] = [];
    for (const ch of line) out.push(...buffer.push(ch));
    expect(out).toEqual(["LOG,scores,downtown=0.02,remera=0.93"]);
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
