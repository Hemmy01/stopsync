// Simulated RFID cards for the demo (future: a real RC522 reader).

export interface DemoCard {
  id: string;
  label: string;
}

export const DEMO_CARDS: readonly DemoCard[] = [1, 2, 3, 4, 5].map((n) => ({
  id: `CARD-0${n}`,
  label: `Demo card ${n}`,
}));

export const TEST_CARD_PREFIX = "TEST-";

/**
 * A card id never used before, for repeated board tests: each tap is a new
 * passenger, so it is never "already in the queue". Dashboard "Reset demo" clears them.
 */
export function newTestCardId(now: number = Date.now()): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `${TEST_CARD_PREFIX}${now.toString(36)}${random}`.toUpperCase();
}
