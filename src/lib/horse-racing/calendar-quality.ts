/**
 * Quality checks + last-good recovery for racing calendar exports.
 * A failed HorseRacing.net scrape must not replace a healthy same-day card.
 */
import { readFile } from "fs/promises";
import path from "path";
import type { RacingCalendarPayload } from "./types";

const ODDS_COVERAGE_MIN = 0.25;
const MIN_RUNNERS_FOR_CHECK = 8;

export interface CalendarOddsCoverage {
  date?: string;
  runners: number;
  withOdds: number;
  rate: number;
}

function performanceMirrorBase(): string | null {
  if (process.env.RACING_PERFORMANCE_MIRROR === "0") return null;
  const raw =
    process.env.RACING_PERFORMANCE_MIRROR_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://statmanac.com";
  return raw.replace(/\/$/, "");
}

export function calendarOddsCoverage(
  calendar: RacingCalendarPayload
): CalendarOddsCoverage {
  const today = calendar.days[0];
  const runners =
    today?.meetings.flatMap((m) => m.races.flatMap((r) => r.runners)) ?? [];
  const withOdds = runners.filter((r) => r.odds != null && r.odds > 1).length;
  return {
    date: today?.date,
    runners: runners.length,
    withOdds,
    rate: runners.length ? withOdds / runners.length : 0,
  };
}

export function isCalendarEnrichmentDegraded(
  calendar: RacingCalendarPayload
): boolean {
  if (calendar.enrichmentWarning) return true;
  const cov = calendarOddsCoverage(calendar);
  return cov.runners >= MIN_RUNNERS_FOR_CHECK && cov.rate < ODDS_COVERAGE_MIN;
}

export function shouldPreferPreviousCalendar(
  next: RacingCalendarPayload,
  prev: RacingCalendarPayload | null
): boolean {
  if (!prev?.days?.length) return false;
  const nextCov = calendarOddsCoverage(next);
  const prevCov = calendarOddsCoverage(prev);
  if (!nextCov.date || !prevCov.date || nextCov.date !== prevCov.date) {
    return false;
  }
  // Previous must look like a real enriched card
  if (prevCov.runners < MIN_RUNNERS_FOR_CHECK) return false;
  if (prevCov.rate < ODDS_COVERAGE_MIN) return false;

  // New export is thin / failed enrichment
  if (!isCalendarEnrichmentDegraded(next)) return false;

  // Prefer previous when it has meaningfully better odds coverage
  return prevCov.rate >= nextCov.rate + 0.05 || prevCov.withOdds > nextCov.withOdds;
}

/**
 * Merge fresh learning/track-record onto a kept prior card payload.
 */
export function mergeKeptRacingCalendar(
  previous: RacingCalendarPayload,
  latest: RacingCalendarPayload
): RacingCalendarPayload {
  const prevExported = previous.exportedAt;
  return {
    ...previous,
    exportedAt: new Date().toISOString(),
    model: latest.model ?? previous.model,
    performance: latest.performance ?? previous.performance,
    enrichmentWarning: undefined,
    servedPriorExport: true,
    priorExportNote:
      `Serving last good racecards from ${prevExported} — this export's HorseRacing.net enrichment failed, so cards were not overwritten.`,
  };
}

export async function loadPreviousRacingCalendar(
  localPath: string
): Promise<RacingCalendarPayload | null> {
  try {
    const raw = await readFile(localPath, "utf8");
    const parsed = JSON.parse(raw) as RacingCalendarPayload;
    if (parsed?.days?.length) return parsed;
  } catch {
    // fall through to live site
  }

  const base = performanceMirrorBase();
  if (!base) return null;
  try {
    const res = await fetch(
      `${base}/data/horse-racing/todays-races/calendar.json`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (!res.ok) return null;
    const parsed = (await res.json()) as RacingCalendarPayload;
    return parsed?.days?.length ? parsed : null;
  } catch {
    return null;
  }
}

export function publicCalendarPath(cwd = process.cwd()): string {
  return path.join(
    cwd,
    "public",
    "data",
    "horse-racing",
    "todays-races",
    "calendar.json"
  );
}
