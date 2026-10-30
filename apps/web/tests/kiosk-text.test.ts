import { describe, expect, it } from "vitest";
import { DESTINATIONS, gestureHintFor } from "@/lib/destinations";
import { KIOSK_TEXT, LANGS, type KioskText } from "@/lib/kiosk-text";
import { selectionLabel } from "@/lib/kiosk-machine";
import { ticketStatus } from "@/lib/queue";
import type { Bus } from "@/lib/departures";

const REASON_CODES = ["waited_too_long", "other_transport", "changed_destination", "wrong_stop", "emergency", "other"];

/** Every plain string in the text, so none can be left empty. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const bus = (status: string, eta: number | null = 6) => ({ id: "R2-01", destination: "REM", status, eta_minutes: eta }) as Bus;

describe("kiosk text", () => {
  it("has no empty strings in either language", () => {
    for (const lang of LANGS) {
      expect(strings(KIOSK_TEXT[lang]).filter((s) => s.trim() === "")).toEqual([]);
    }
  });

  it("keeps English exactly as the existing helpers say it", () => {
    const en = KIOSK_TEXT.en;
    const sel = { code: "KIM", method: "voice", confidence: 0.91 } as const;
    expect(en.selection(sel)).toBe(selectionLabel(sel));
    for (const d of DESTINATIONS) {
      expect(en.gestureHint(d.code, "swipe")).toBe(gestureHintFor(d, "swipe"));
      expect(en.gestureHint(d.code, "rule")).toBe(gestureHintFor(d, "rule"));
    }
    const status = ticketStatus(undefined, "REM", [bus("on_the_way")], 3);
    expect(en.ticketStatus(status)).toBe("Bus R2-01 is on the way · about 6 min");
  });

  it("gives Kinyarwanda its own text for every ticket status, gesture and cancel reason", () => {
    const rw: KioskText = KIOSK_TEXT.rw;
    const statuses = [
      ticketStatus(undefined, "REM", [], null),
      ticketStatus(undefined, "REM", [bus("on_the_way")], 1),
      ticketStatus({ id: 1, code: "R2-001", destination: "REM", status: "boarded", bus_id: "R2-01", created_at: "" }, "REM", [], null),
      ticketStatus({ id: 1, code: "R2-001", destination: "REM", status: "waiting", bus_id: null, created_at: "" }, "REM", [bus("arrived")], 2),
      ticketStatus({ id: 1, code: "R2-001", destination: "REM", status: "cancelled", bus_id: null, created_at: "" }, "REM", [], null),
    ];
    for (const s of statuses) expect(rw.ticketStatus(s)).not.toBe(s.line);
    expect(rw.ticketStatus(statuses[1])).toBe("Bisi R2-01 iri mu nzira · hafi iminota 6");
    for (const d of DESTINATIONS) {
      expect(rw.gestureHint(d.code, "swipe")).not.toBe(gestureHintFor(d, "swipe"));
      expect(rw.gestureHint(d.code, "rule")).not.toBe(gestureHintFor(d, "rule"));
    }
    for (const code of REASON_CODES) expect(rw.reason({ code, label: "English" })).not.toBe("English");
    expect(rw.reason({ code: "new_reason", label: "New reason" })).toBe("New reason");
  });
});
