// What the kiosk says out loud: new ticket numbers and buses boarding. Pure.
// English only for now: browsers rarely ship a Kinyarwanda voice.

/** "R2-004" → "R 2, 0 0 4": letter by letter, digits one at a time, so speech engines don't say "two thousand four". */
export function spellCode(code: string): string {
  return code
    .split("-")
    .map((part) => part.split("").join(" "))
    .join(", ");
}

export function ticketAnnouncement(code: string, destinationName: string): string {
  return `Your number is ${spellCode(code)}, to ${destinationName}.`;
}

export function boardingAnnouncement(
  busId: string,
  destinationName: string,
  firstCode: string,
  lastCode: string,
): string {
  const tickets =
    firstCode === lastCode ? `ticket ${spellCode(firstCode)}` : `tickets ${spellCode(firstCode)} to ${spellCode(lastCode)}`;
  return `Bus ${spellCode(busId)} to ${destinationName} is now boarding ${tickets}.`;
}

/** Identifies one boarding call, so it is announced once. */
export const boardingKey = (b: { busId: string; lastCode: string; count: number }) => `${b.busId}:${b.lastCode}:${b.count}`;
