// Mirrors haversine_m() and the ETA rule in update_bus_location() (Postgres),
// so the bus page can preview what the database will compute.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Whole minutes to cover a distance, rounded up, never less than 1. */
export function etaMinutes(distanceM: number, speedKmh: number): number {
  const speed = Math.max(speedKmh, 1);
  return Math.max(Math.ceil((distanceM / 1000 / speed) * 60), 1);
}

/** "about 6 min", or "under a minute" for very small values. */
export function formatEta(minutes: number | null | undefined): string {
  if (minutes == null) return "ETA unknown";
  if (minutes < 1) return "under a minute";
  return `about ${minutes} min`;
}
