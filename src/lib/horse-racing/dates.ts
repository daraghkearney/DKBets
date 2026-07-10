/** ISO date helpers for the racing calendar (today + 6 days). */

export interface RacingDayOption {
  date: string;
  offset: number;
  label: string;
  shortLabel: string;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * "Today" anchored to UK racing time (Europe/London). CI runs in UTC, so
 * late-evening runs would otherwise label tomorrow's cards with today's
 * date (the API's "today" follows UK time).
 */
export function ukToday(): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
  }).format(new Date());
  return new Date(`${iso}T12:00:00Z`);
}

/** Normalize a race time to 24h HH:MM (API cards use 12h like "2:05"). */
export function to24hTime(time: string): string {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return time.trim();
  let h = Number(m[1]);
  // UK/IRE racing runs ~11:00-21:30, so 1-10 o'clock means afternoon/evening
  if (h >= 1 && h <= 10) h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

export function racingWeekDays(base = ukToday()): RacingDayOption[] {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const fmtShort = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

  return Array.from({ length: 7 }, (_, offset) => {
    const d = addDays(base, offset);
    const date = toIsoDate(d);
    return {
      date,
      offset,
      label: offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : fmt.format(d),
      shortLabel: offset === 0 ? "Today" : offset === 1 ? "Tmrw" : fmtShort.format(d),
    };
  });
}

export function courseSlug(course: string): string {
  return course
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function courseMatchesHint(course: string, hint: string): boolean {
  const slug = courseSlug(course);
  const h = hint.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return slug.includes(h) || h.includes(slug);
}
