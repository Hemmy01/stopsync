import { describe, expect, it } from "vitest";
import { boardingAnnouncement, calledKey, spellCode, ticketAnnouncement, unannouncedCalls } from "@/lib/announce";

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

  it("announces only tickets not called out yet", () => {
    const parked = { busId: "R2-01", destination: "REM", codes: ["R2-001", "R2-002", "R2-003", "R2-004"] };
    const heard = new Set(["R2-001", "R2-002", "R2-003"].map((c) => calledKey("R2-01", c)));
    // A ticket made while the bus is parked: just that ticket.
    expect(unannouncedCalls([parked], heard)).toEqual([
      { busId: "R2-01", destination: "REM", firstCode: "R2-004", lastCode: "R2-004" },
    ]);
    // A fresh arrival: the whole range.
    expect(unannouncedCalls([parked], new Set())).toEqual([
      { busId: "R2-01", destination: "REM", firstCode: "R2-001", lastCode: "R2-004" },
    ]);
    // Nothing new: nothing said.
    expect(unannouncedCalls([parked], new Set(parked.codes.map((c) => calledKey("R2-01", c))))).toEqual([]);
  });
});
