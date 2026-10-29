// The kiosk's live queue: positions, who is boarding now, and each ticket's status. Pure.
// Boarding itself happens in Postgres (board_queue: oldest first, up to free places).

import { departureStatus, type Bus } from "./departures";
import { formatEta } from "./eta";

/** A ticket at this kiosk, waiting or boarded on a bus. */
export interface QueueToken {
  id: number;
  code: string;
  destination: string;
  status: string;
  bus_id: string | null;
  created_at: string;
}

const fifo = (a: QueueToken, b: QueueToken) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id;

/** The newest ticket with this code (codes restart every day). */
export function findTicket(tokens: readonly QueueToken[], code: string): QueueToken | undefined {
  return tokens.filter((t) => t.code === code).sort(fifo).at(-1);
}

/** Place in its route's queue at this stop (1 = next to board), or null if not waiting. */
export function queuePosition(tokens: readonly QueueToken[], ticket: QueueToken): number | null {
  if (ticket.status !== "waiting") return null;
  const ahead = tokens.filter(
    (t) => t.status === "waiting" && t.destination === ticket.destination && fifo(t, ticket) < 0,
  );
  return ahead.length + 1;
}

export interface Boarding {
  busId: string;
  destination: string;
  count: number;
  firstCode: string;
  lastCode: string;
}

/** Buses at this stop and the tickets they called here, in boarding order. */
export function boardingNow(buses: readonly Bus[], tokens: readonly QueueToken[]): Boarding[] {
  return buses
    .filter((b) => b.status === "arrived")
    .flatMap((b) => {
      const called = tokens.filter((t) => t.status === "boarded" && t.bus_id === b.id).sort(fifo);
      if (called.length === 0) return [];
      return [
        {
          busId: b.id,
          destination: b.destination,
          count: called.length,
          firstCode: called[0].code,
          lastCode: called[called.length - 1].code,
        },
      ];
    });
}

/** "R2-010–R2-045", or just "R2-010" for one ticket. */
export function ticketRange(b: Pick<Boarding, "firstCode" | "lastCode">): string {
  return b.firstCode === b.lastCode ? b.firstCode : `${b.firstCode}–${b.lastCode}`;
}

export type TicketStatus =
  | { kind: "waiting"; line: string }
  | { kind: "on_the_way"; line: string; busId: string; etaMinutes: number | null }
  /** The ticket was boarded: its bus is here. */
  | { kind: "called"; line: string; busId: string }
  /** A bus for the route is at the stop but didn't take this ticket (full, or ticket came later). */
  | { kind: "not_called"; line: string; busId: string; position: number | null; known: boolean }
  | { kind: "done"; line: string; ended: "completed" | "cancelled" | "invalid" };

/** What the ticket's status panel says, from the ticket itself and the route's buses. */
export function ticketStatus(
  ticket: QueueToken | undefined,
  destination: string,
  buses: readonly Bus[],
  position: number | null,
): TicketStatus {
  if (ticket?.status === "boarded" && ticket.bus_id) {
    return { kind: "called", line: "Your bus is here, please board", busId: ticket.bus_id };
  }
  if (ticket && ticket.status !== "waiting") {
    const ended = ticket.status === "completed" ? "completed" : ticket.status === "cancelled" ? "cancelled" : "invalid";
    const line = { completed: "Trip completed", cancelled: "Place cancelled", invalid: "Ticket no longer valid" }[ended];
    return { kind: "done", line, ended };
  }

  const route = departureStatus(destination, buses);
  switch (route.kind) {
    case "on_the_way":
      return {
        kind: "on_the_way",
        line: `Bus ${route.busId} is on the way · ${formatEta(route.etaMinutes)}`,
        busId: route.busId,
        etaMinutes: route.etaMinutes,
      };
    case "boarding":
      // Until the ticket row arrives over Realtime we can't tell whether it was called.
      return ticket
        ? {
            kind: "not_called",
            line: `Not on ${route.busId} · you keep your place${position ? ` (No. ${position})` : ""}`,
            busId: route.busId,
            position,
            known: true,
          }
        : { kind: "not_called", line: `Bus ${route.busId} is at the stop`, busId: route.busId, position, known: false };
    case "waiting":
      return { kind: "waiting", line: "Waiting for dispatch" };
  }
}
