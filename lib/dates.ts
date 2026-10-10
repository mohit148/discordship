export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Elapsed time in ms since `iso`, clamped to never go negative. A "just
 * created" timestamp should never read as being in the future — but a
 * couple of seconds of clock skew between the app server and the database
 * (or simple network/processing latency between the insert and the render)
 * can otherwise push `new Date(iso)` fractionally ahead of `Date.now()`,
 * which both of the functions below treat defensively anyway, but clamping
 * here means neither has to special-case it separately.
 */
function msSince(iso: string): number {
  return Math.max(0, Date.now() - new Date(iso).getTime());
}

export function relativeTimeSince(iso: string): string {
  // Floors to whole elapsed days from the exact ms diff — not a calendar
  // comparison — so this can never move a "just now" timestamp into "1 day
  // ago" just because a calendar-day boundary (midnight, in whatever
  // timezone) sits between creation and viewing. A ship made 30 seconds
  // ago reads as 0 elapsed days no matter what time of day it is.
  const days = Math.floor(msSince(iso) / DAY_MS);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/** "2 months, 3 days"-style duration since a ship started. */
export function durationSince(iso: string, endIso?: string | null): { years: number; months: number; days: number; label: string } {
  // Same elapsed-ms approach as relativeTimeSince, for the same reason:
  // the previous version compared calendar fields (getFullYear/getMonth/
  // getDate) between two Date objects, which answers "how many times has
  // local midnight passed", not "how much time has elapsed" — those only
  // agree if both reads happen in the same timezone with no clock skew
  // between the app server and wherever the timestamp came from. A ship
  // whose createdAt lands even slightly "after" the server's own clock (a
  // few seconds of DB/app skew) could otherwise come out as "yesterday"
  // the instant it's created. Elapsed milliseconds has no such ambiguity.
  // For an ended ship, the span is start→end rather than start→now.
  const spanMs = endIso ? Math.max(0, new Date(endIso).getTime() - new Date(iso).getTime()) : msSince(iso);
  const spanDays = Math.floor(spanMs / DAY_MS);

  const years = Math.floor(spanDays / 365);
  const remainderAfterYears = spanDays - years * 365;
  const months = Math.floor(remainderAfterYears / 30);
  const days = remainderAfterYears - months * 30;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (parts.length < 2 && days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (parts.length === 0) parts.push("today");

  return { years, months, days, label: parts.slice(0, 2).join(", ") };
}

function nextOccurrence(startIso: string, unit: "month" | "year"): Date {
  const start = new Date(startIso);
  const now = new Date();
  const next = new Date(start);

  if (unit === "month") {
    // Advance month-by-month until it's in the future.
    while (next.getTime() <= now.getTime()) {
      next.setMonth(next.getMonth() + 1);
    }
  } else {
    while (next.getTime() <= now.getTime()) {
      next.setFullYear(next.getFullYear() + 1);
    }
  }
  return next;
}

export function nextMonthlyAnniversary(startIso: string): { date: Date; daysAway: number } {
  const date = nextOccurrence(startIso, "month");
  const daysAway = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return { date, daysAway };
}

export function nextYearlyAnniversary(startIso: string): { date: Date; daysAway: number } {
  const date = nextOccurrence(startIso, "year");
  const daysAway = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return { date, daysAway };
}
