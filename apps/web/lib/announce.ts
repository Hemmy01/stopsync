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

export interface BoardingCall {
  busId: string;
  destination: string;
  firstCode: string;
  lastCode: string;
}

/** Identifies one called ticket on one bus. */
export const calledKey = (busId: string, code: string) => `${busId}:${code}`;

/**
 * The tickets each bus called that haven't been announced yet, one call per bus. A parked bus
 * that takes a new ticket announces just that ticket, not the whole range again.
 */
export function unannouncedCalls(
  boardings: readonly { busId: string; destination: string; codes: readonly string[] }[],
  announced: ReadonlySet<string>,
): BoardingCall[] {
  return boardings.flatMap((b) => {
    const fresh = b.codes.filter((code) => !announced.has(calledKey(b.busId, code)));
    if (fresh.length === 0) return [];
    return [{ busId: b.busId, destination: b.destination, firstCode: fresh[0], lastCode: fresh[fresh.length - 1] }];
  });
}
