// Seats, standing places and who is on board. Pure.
// Mirrors bus_free_places() and the free-place rule in run_dispatch() (Postgres).

import type { Bus } from "./departures";

type Places = Pick<Bus, "seats" | "standing" | "occupancy">;

export const totalPlaces = (b: Places) => b.seats + b.standing;

export const freePlaces = (b: Places) => Math.max(totalPlaces(b) - b.occupancy, 0);

/** Seats fill first; standing places only once every seat is taken. */
export const freeSeats = (b: Places) => Math.max(b.seats - b.occupancy, 0);

export const freeStanding = (b: Places) => Math.min(b.standing, freePlaces(b));

/** "18 seats + 30 standing free", "Full". */
export function freeLabel(b: Places): string {
  if (freePlaces(b) === 0) return "Full";
  const seats = freeSeats(b);
  const standing = freeStanding(b);
  if (seats === 0) return `${standing} standing free`;
  return `${seats} ${seats === 1 ? "seat" : "seats"} + ${standing} standing free`;
}

export interface DispatchPlaces {
  /** Buses on the way to the kiosk for this destination. */
  onTheWay: number;
  /** Their free places together: these waiting passengers are already covered. */
  onTheWayFree: number;
  /** Free places on the bus HQ would release next (the emptiest at the terminal). */
  nextFree: number;
}

export function dispatchPlaces(destination: string, buses: readonly Bus[], fallbackCapacity: number): DispatchPlaces {
  const forRoute = buses.filter((b) => b.destination === destination);
  const otw = forRoute.filter((b) => b.status === "on_the_way");
  const atTerminal = forRoute.filter((b) => b.status === "at_terminal").map(freePlaces);
  return {
    onTheWay: otw.length,
    onTheWayFree: otw.reduce((n, b) => n + freePlaces(b), 0),
    nextFree: Math.max(atTerminal.length > 0 ? Math.max(...atTerminal) : fallbackCapacity, 1),
  };
}
