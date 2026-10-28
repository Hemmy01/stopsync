import { describe, expect, it } from "vitest";
import { DEMO_CARDS, newTestCardId, TEST_CARD_PREFIX } from "@/lib/demo-cards";

describe("newTestCardId", () => {
  it("is never a demo card and never repeats", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newTestCardId()));
    expect(ids.size).toBe(500);
    for (const id of ids) {
      expect(id.startsWith(TEST_CARD_PREFIX)).toBe(true);
      expect(id).toMatch(/^TEST-[0-9A-Z]+$/);
      expect(DEMO_CARDS.map((c) => c.id)).not.toContain(id);
    }
  });
});
