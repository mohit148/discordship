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

export function relativeTimeSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
  const start = new Date(iso);
  // For a ship that has ended, its duration stops at the day it ended.
  const now = endIso ? new Date(endIso) : new Date();

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

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
