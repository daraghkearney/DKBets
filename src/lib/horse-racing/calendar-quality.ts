/**
 * Quality checks + last-good recovery for racing calendar exports.
 * A failed / thinner HorseRacing.net scrape must never replace a richer
 * same-day card — even a partial enrichment (e.g. 38 priced runners)
 * beats a total wipe to 0.
 */
import { readFile } from "fs/promises";
import path from "path";
import type { RacingCalendarPayload } from "./types";

/** Soft "healthy" bar used for UI / logging — NOT a gate for keep-last-good. */
const ODDS_COVERAGE_HEALTHY = 0.25;
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
  const withOdds = runners.filter(
    (r) => r.odds != null && r.odds > 1 && r.odds <= 501
  ).length;
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
  return (
    cov.runners >= MIN_RUNNERS_FOR_CHECK && cov.rate < ODDS_COVERAGE_HEALTHY
  );
}

/**
 * Keep the previous same-day calendar whenever it has meaningfully more
 * live odds than the new export. Critical: a partial card (e.g. 38/378)
 * must never be overwritten by 0/378 — the old gate required ≥25% coverage
 * on the previous file, which let exactly that regression through.
 */
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
  if (prevCov.runners < MIN_RUNNERS_FOR_CHECK) return false;
  if (prevCov.withOdds <= 0) return false;

  // Absolute rule: never go backwards on priced runners for the same day
  if (prevCov.withOdds > nextCov.withOdds) {
    // Require a real improvement gap so tiny noise doesn't flip-flop
    const absoluteGain = prevCov.withOdds - nextCov.withOdds;
    const rateGain = prevCov.rate - nextCov.rate;
    if (nextCov.withOdds === 0) return true;
    if (absoluteGain >= 3) return true;
    if (rateGain >= 0.03) return true;
  }

  return false;
}

/**
 * Merge fresh learning/track-record onto a kept prior card payload.
 */
export function mergeKeptRacingCalendar(
  previous: RacingCalendarPayload,
  latest: RacingCalendarPayload
): RacingCalendarPayload {
  const prevExported = previous.exportedAt;
  const prevCov = calendarOddsCoverage(previous);
  const nextCov = calendarOddsCoverage(latest);
  return {
    ...previous,
    exportedAt: new Date().toISOString(),
    model: latest.model ?? previous.model,
    performance: latest.performance ?? previous.performance,
    naps: latest.naps?.length ? latest.naps : previous.naps,
    // Keep warning if the preserved card is still thin — honesty over silence
    enrichmentWarning:
      prevCov.rate < ODDS_COVERAGE_HEALTHY
        ? previous.enrichmentWarning ??
          `Live odds still limited (${prevCov.withOdds}/${prevCov.runners}) — kept last enrichment rather than overwriting with a worse scrape (${nextCov.withOdds}/${nextCov.runners}).`
        : undefined,
    servedPriorExport: true,
    priorExportNote:
      `Serving last racecards from ${prevExported} ` +
      `(${prevCov.withOdds}/${prevCov.runners} priced) — this export only had ` +
      `${nextCov.withOdds}/${nextCov.runners} and was not allowed to overwrite.`,
  };
}

async function loadCalendarFile(
  filePath: string
): Promise<RacingCalendarPayload | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as RacingCalendarPayload;
    return parsed?.days?.length ? parsed : null;
  } catch {
    return null;
  }
}

/** Local seed written by `scripts/seed-racing-odds-local.ts` (non-blocked IP). */
export function racingCalendarSeedPath(cwd = process.cwd()): string {
  return path.join(cwd, "data", "racing-cards", "calendar-seed.json");
}

function pickRicherCalendar(
  candidates: RacingCalendarPayload[]
): RacingCalendarPayload | null {
  const usable = candidates.filter((c) => c?.days?.length);
  if (!usable.length) return null;
  return usable.reduce((best, cur) => {
    const a = calendarOddsCoverage(best);
    const b = calendarOddsCoverage(cur);
    if (a.date && b.date && a.date === b.date) {
      return b.withOdds > a.withOdds ? cur : best;
    }
    return b.withOdds > a.withOdds ? cur : best;
  });
}

export async function loadPreviousRacingCalendar(
  localPath: string
): Promise<RacingCalendarPayload | null> {
  const local = await loadCalendarFile(localPath);
  const seed = await loadCalendarFile(racingCalendarSeedPath());

  let live: RacingCalendarPayload | null = null;
  const base = performanceMirrorBase();
  if (base) {
    try {
      const res = await fetch(
        `${base}/data/horse-racing/todays-races/calendar.json`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        }
      );
      if (res.ok) {
        const parsed = (await res.json()) as RacingCalendarPayload;
        if (parsed?.days?.length) live = parsed;
      }
    } catch {
      // ignore
    }
  }

  // Prefer the same-day snapshot with the most live odds (seed wins when CI is blind)
  return pickRicherCalendar(
    [local, seed, live].filter((c): c is RacingCalendarPayload => c != null)
  );
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
