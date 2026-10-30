import { describe, expect, it } from "vitest";
import { SCREENS, screenOpensFor } from "@/lib/screens";

const labelsFor = (role: Parameters<typeof screenOpensFor>[1]) =>
  SCREENS.filter((s) => screenOpensFor(s, role)).map((s) => s.label);

describe("screens per role", () => {
  it("admin can open every screen", () => {
    expect(labelsFor("admin")).toEqual(SCREENS.map((s) => s.label));
  });

  it("each role sees its own screen plus the public ones", () => {
    expect(labelsFor("driver")).toEqual(["Bus", "Live board", "About"]);
    expect(labelsFor("kiosk")).toEqual(["Kiosk", "Live board", "About"]);
    expect(labelsFor("viewer")).toEqual(["Dashboard", "Live board", "About"]);
    expect(labelsFor(null)).toEqual(["Live board", "About"]);
  });
});
