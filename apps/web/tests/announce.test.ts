import { describe, expect, it } from "vitest";
import { boardingAnnouncement, boardingKey, spellCode, ticketAnnouncement } from "@/lib/announce";

describe("announcements", () => {
  it("spells codes so they are read digit by digit", () => {
    expect(spellCode("R2-004")).toBe("R 2, 0 0 4");
    expect(spellCode("R4-01")).toBe("R 4, 0 1");
  });

  it("reads a new ticket", () => {
    expect(ticketAnnouncement("R3-014", "Kimironko")).toBe("Your number is R 3, 0 1 4, to Kimironko.");
  });

  it("reads one ticket or a range boarding", () => {
    expect(boardingAnnouncement("R2-01", "Remera", "R2-004", "R2-004")).toBe(
      "Bus R 2, 0 1 to Remera is now boarding ticket R 2, 0 0 4.",
    );
    expect(boardingAnnouncement("R2-01", "Remera", "R2-001", "R2-004")).toMatch(/tickets R 2, 0 0 1 to R 2, 0 0 4\.$/);
  });

  it("gives a new key when more tickets board on the same bus", () => {
    expect(boardingKey({ busId: "R2-01", lastCode: "R2-004", count: 4 })).not.toBe(
      boardingKey({ busId: "R2-01", lastCode: "R2-005", count: 5 }),
    );
  });
});
