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

export function racingWeekDays(base = new Date()): RacingDayOption[] {
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
