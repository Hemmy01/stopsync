import { describe, expect, it } from "vitest";
import { actionForKey, clampSlide, progressSegments, slideFromHash } from "@/lib/pitch-nav";

describe("pitch navigation", () => {
  it("reads the slide from the hash and clamps it", () => {
    expect(slideFromHash("#5", 14)).toBe(5);
    expect(slideFromHash("5", 14)).toBe(5);
    expect(slideFromHash("#99", 14)).toBe(14);
    expect(slideFromHash("#0", 14)).toBe(1);
    expect(slideFromHash("", 14)).toBe(1);
    expect(slideFromHash("#abc", 14)).toBe(1);
    expect(clampSlide(Number.NaN, 14)).toBe(1);
  });

  it("maps presenter keys", () => {
    expect(actionForKey("ArrowRight", 3, 14)).toEqual({ type: "go", slide: 4 });
    expect(actionForKey(" ", 3, 14)).toEqual({ type: "go", slide: 4 });
    expect(actionForKey("ArrowLeft", 3, 14)).toEqual({ type: "go", slide: 2 });
    expect(actionForKey("ArrowRight", 14, 14)).toEqual({ type: "go", slide: 14 });
    expect(actionForKey("ArrowLeft", 1, 14)).toEqual({ type: "go", slide: 1 });
    expect(actionForKey("Home", 7, 14)).toEqual({ type: "go", slide: 1 });
    expect(actionForKey("End", 7, 14)).toEqual({ type: "go", slide: 14 });
    expect(actionForKey("n", 7, 14)).toEqual({ type: "toggle-notes" });
    expect(actionForKey("F", 7, 14)).toEqual({ type: "fullscreen" });
    expect(actionForKey("x", 7, 14)).toBeNull();
  });

  it("fills the four progress segments in order", () => {
    expect(progressSegments(14, 14)).toEqual([1, 1, 1, 1]);
    expect(progressSegments(7, 14)).toEqual([1, 1, 0, 0]);
    const first = progressSegments(1, 14);
    expect(first[0]).toBeCloseTo(4 / 14);
    expect(first.slice(1)).toEqual([0, 0, 0]);
  });
});
