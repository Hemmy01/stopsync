export const KIGALI_TZ = "Africa/Kigali";

const hhmm = new Intl.DateTimeFormat("en-GB", {
  timeZone: KIGALI_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const hhmmss = new Intl.DateTimeFormat("en-GB", {
  timeZone: KIGALI_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** 24-hour Kigali time, e.g. "18:05" or "18:05:09". */
export function formatKigaliTime(date: Date, withSeconds = false): string {
  return (withSeconds ? hhmmss : hhmm).format(date);
}

/** Whole minutes elapsed since an ISO timestamp (never negative). */
export function minutesSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000));
}

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: KIGALI_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO timestamp of the most recent midnight in Kigali (UTC+2, no DST). */
export function kigaliDayStartISO(now: Date = new Date()): string {
  return new Date(`${ymd.format(now)}T00:00:00+02:00`).toISOString();
}
