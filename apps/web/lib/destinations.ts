// Single source for destination display config in the web app.
// The database seed (supabase/seed.sql) is the only other place these appear.

export interface Destination {
  code: string;
  name: string;
  route: string;
  /** CSS variable holding the route colour. */
  color: string;
}

export const DESTINATIONS = [
  { code: "NYA", name: "Nyabugogo", route: "R1", color: "var(--route-1)" },
  { code: "REM", name: "Remera", route: "R2", color: "var(--route-2)" },
  { code: "KIM", name: "Kimironko", route: "R3", color: "var(--route-3)" },
  { code: "DTN", name: "Downtown", route: "R4", color: "var(--route-4)" },
] as const satisfies readonly Destination[];

export type DestinationCode = (typeof DESTINATIONS)[number]["code"];

const BY_CODE = new Map<string, Destination>(DESTINATIONS.map((d) => [d.code, d]));

export function isDestinationCode(value: string): value is DestinationCode {
  return BY_CODE.has(value);
}

export function getDestination(code: string): Destination | undefined {
  return BY_CODE.get(code);
}
