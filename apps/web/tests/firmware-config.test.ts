// The destination mapping lives in three places (CLAUDE.md section 3). This test
// keeps firmware/kiosk_node/config.h and lib/destinations.ts in step.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/lib/destinations";

const CONFIG_H = join(__dirname, "../../../firmware/kiosk_node/config.h");

interface FirmwareDestination {
  code: string;
  route: string;
  voiceLabel: string;
  gestureLabel: string;
  tapLabel: string;
}

/** Rows of the DESTINATIONS[] table: { "REM", "R2", "remera", "swipe_left", "one_tap", r, g, b }. */
export function parseFirmwareDestinations(source: string): FirmwareDestination[] {
  const table = source.match(/DESTINATIONS\[\]\s*=\s*\{([\s\S]*?)\n\};/);
  if (!table) throw new Error("DESTINATIONS[] table not found in config.h");
  const row = /\{\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*\d+,\s*\d+,\s*\d+\s*\}/g;
  return [...table[1].matchAll(row)].map(([, code, route, voiceLabel, gestureLabel, tapLabel]) => ({
    code,
    route,
    voiceLabel,
    gestureLabel,
    tapLabel,
  }));
}

describe("firmware config.h ↔ destinations.ts", () => {
  const firmware = parseFirmwareDestinations(readFileSync(CONFIG_H, "utf8"));
  const byCode = (code: string) => firmware.find((f) => f.code === code);

  it("has the same set of destination codes", () => {
    expect(firmware.map((f) => f.code).sort()).toEqual(DESTINATIONS.map((d) => d.code).sort());
  });

  it.each(DESTINATIONS.map((d) => [d.code, d] as const))("%s has the same route and labels", (code, d) => {
    expect(byCode(code)).toEqual({
      code: d.code,
      route: d.route,
      voiceLabel: d.voiceLabel,
      gestureLabel: d.gestureLabel,
      tapLabel: d.tapLabel,
    });
  });

  it("parser rejects a file without the table", () => {
    expect(() => parseFirmwareDestinations("// nothing here")).toThrow();
  });
});
