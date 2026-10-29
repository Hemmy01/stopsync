// Why passengers give up their place (Phase 6). Labels live in the cancel_reasons table.

import type { Tables } from "./database.types";

export type CancelReason = Tables<"cancel_reasons">;

type CancellableToken = Pick<Tables<"queue_tokens">, "status" | "cancel_reason" | "cancelled_at" | "created_at">;

export interface ReasonCount {
  code: string;
  label: string;
  count: number;
}

export interface CancellationStats {
  /** Tickets issued today plus older ones cancelled today. */
  tickets: number;
  cancelled: number;
  /** 0–100, whole percent; 0 when there are no tickets. */
  ratePct: number;
  /** Every reason in its sort order, with today's count (zeros kept so the chart is stable). */
  reasons: ReasonCount[];
}

/** Cancellations today in Kigali time, given the day's start as an ISO time. */
export function cancellationStats(
  tokens: readonly CancellableToken[],
  reasons: readonly CancelReason[],
  dayStartISO: string,
): CancellationStats {
  const dayStart = new Date(dayStartISO).getTime();
  const isToday = (iso: string | null) => iso !== null && new Date(iso).getTime() >= dayStart;
  const cancelledToday = tokens.filter((t) => t.status === "cancelled" && isToday(t.cancelled_at));
  const tickets = tokens.filter((t) => isToday(t.created_at) || cancelledToday.includes(t)).length;
  const cancelled = cancelledToday.length;
  return {
    tickets,
    cancelled,
    ratePct: tickets ? Math.round((cancelled / tickets) * 100) : 0,
    reasons: [...reasons]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({ code: r.code, label: r.label, count: cancelledToday.filter((t) => t.cancel_reason === r.code).length })),
  };
}
