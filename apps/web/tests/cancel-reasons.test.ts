import { describe, expect, it } from "vitest";
import { cancellationStats, type CancelReason } from "@/lib/cancel-reasons";
import { parseCancelTokenResult } from "@/lib/rpc";

const DAY_START = "2026-10-28T22:00:00.000Z"; // Kigali midnight, 29 Oct
const REASONS: CancelReason[] = [
  { code: "other", label: "Other", sort_order: 6 },
  { code: "waited_too_long", label: "Waited too long", sort_order: 1 },
];

const tok = (status: string, created_at: string, cancel_reason: string | null = null, cancelled_at: string | null = null) => ({
  status,
  created_at,
  cancel_reason,
  cancelled_at,
});

describe("cancellationStats", () => {
  it("counts today's cancellations by reason, in reason order, with the rate", () => {
    const tokens = [
      tok("waiting", "2026-10-29T08:00:00Z"),
      tok("boarded", "2026-10-29T08:05:00Z"),
      tok("cancelled", "2026-10-29T08:10:00Z", "waited_too_long", "2026-10-29T08:40:00Z"),
      // Queued yesterday, gave up today: counts as today's ticket and cancellation.
      tok("cancelled", "2026-10-28T20:00:00Z", "other", "2026-10-29T07:00:00Z"),
      // Cancelled yesterday: not today.
      tok("cancelled", "2026-10-28T19:00:00Z", "other", "2026-10-28T19:30:00Z"),
    ];
    expect(cancellationStats(tokens, REASONS, DAY_START)).toEqual({
      tickets: 4,
      cancelled: 2,
      ratePct: 50,
      reasons: [
        { code: "waited_too_long", label: "Waited too long", count: 1 },
        { code: "other", label: "Other", count: 1 },
      ],
    });
  });

  it("is 0% with no tickets", () => {
    expect(cancellationStats([], REASONS, DAY_START)).toMatchObject({ tickets: 0, cancelled: 0, ratePct: 0 });
  });
});

describe("parseCancelTokenResult", () => {
  it("reads a cancellation, and explains a ticket that is no longer waiting", () => {
    expect(parseCancelTokenResult({ status: "cancelled", code: "R2-006", destination: "REM" })).toEqual({
      status: "cancelled",
      code: "R2-006",
    });
    expect(parseCancelTokenResult({ status: "not_found", message: "x" })).toMatchObject({ status: "error" });
    expect(parseCancelTokenResult({ status: "error", message: "Unknown reason" })).toEqual({
      status: "error",
      message: "Unknown reason",
    });
    expect(parseCancelTokenResult(null)).toMatchObject({ status: "error" });
  });
});
