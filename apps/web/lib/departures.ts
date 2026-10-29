// Derives what passengers see about each route from live bus rows. Pure.

import type { Tables } from "./database.types";

export type Bus = Tables<"buses">;

export type DepartureStatus =
  | { kind: "waiting" }
  | { kind: "on_the_way"; busId: string; etaMinutes: number | null }
  | { kind: "boarding"; busId: string };

/** A bus on the way wins over one boarding; otherwise waiting for dispatch. */
export function departureStatus(destination: string, buses: readonly Bus[]): DepartureStatus {
  const forRoute = buses.filter((b) => b.destination === destination);

  const onTheWay = forRoute
    .filter((b) => b.status === "on_the_way")
    .sort((a, b) => (a.eta_minutes ?? Infinity) - (b.eta_minutes ?? Infinity))[0];
  if (onTheWay) return { kind: "on_the_way", busId: onTheWay.id, etaMinutes: onTheWay.eta_minutes };

  const arrived = forRoute.find((b) => b.status === "arrived");
  if (arrived) return { kind: "boarding", busId: arrived.id };

  return { kind: "waiting" };
}

/** Short label for the departure strip. */
export function departureLabel(status: DepartureStatus): string {
  switch (status.kind) {
    case "waiting":
      return "Waiting for dispatch";
    case "on_the_way":
      return status.etaMinutes == null ? `${status.busId} · on the way` : `${status.busId} · ${status.etaMinutes} min`;
    case "boarding":
      return "Boarding";
  }
}

/** Waiting passengers per destination code. */
export function countByDestination(rows: readonly { destination: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.destination] = (counts[row.destination] ?? 0) + 1;
  return counts;
}
