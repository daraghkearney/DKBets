/**
 * Quality checks + last-good recovery for racing calendar exports.
 * A failed / thinner HorseRacing.net scrape must never replace a richer
 * same-day card — even a partial enrichment (e.g. 38 priced runners)
 * beats a total wipe to 0.
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { RacingCalendarDay, RacingCalendarPayload } from "./types";

/** Soft "healthy" bar used for UI / logging — NOT a gate for keep-last-good. */
const ODDS_COVERAGE_HEALTHY = 0.25;
const MIN_RUNNERS_FOR_CHECK = 8;
/** Minimum priced runners before we treat a calendar as worth seeding to git. */
const MIN_SEED_ODDS = 50;

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

function dayRunners(day: RacingCalendarDay | undefined) {
  return day?.meetings.flatMap((m) => m.races.flatMap((r) => r.runners)) ?? [];
}

/** Odds coverage for a specific ISO date inside a multi-day calendar. */
export function coverageForDate(
  calendar: RacingCalendarPayload,
  date: string | undefined
): CalendarOddsCoverage {
  if (!date) return { runners: 0, withOdds: 0, rate: 0 };
  const day = calendar.days.find((d) => d.date === date);
  const runners = dayRunners(day);
  const withOdds = runners.filter(
    (r) => r.odds != null && r.odds > 1 && r.odds <= 501
  ).length;
  return {
    date,
    runners: runners.length,
    withOdds,
    rate: runners.length ? withOdds / runners.length : 0,
  };
}

/** Coverage for the calendar's first day (today in a fresh export). */
export function calendarOddsCoverage(
  calendar: RacingCalendarPayload
): CalendarOddsCoverage {
  return coverageForDate(calendar, calendar.days[0]?.date);
}

export function isCalendarEnrichmentHealthy(
  cov: CalendarOddsCoverage
): boolean {
  return (
    cov.runners >= MIN_RUNNERS_FOR_CHECK && cov.rate >= ODDS_COVERAGE_HEALTHY
  );
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
 * live odds than the new export. Looks up the matching ISO date inside
 * `prev` (not only days[0]) so yesterday's "tomorrow" enrichment can
 * protect today's first hourly deploy after midnight.
 */
export function shouldPreferPreviousCalendar(
  next: RacingCalendarPayload,
  prev: RacingCalendarPayload | null
): boolean {
  if (!prev?.days?.length) return false;
  const date = next.days[0]?.date;
  if (!date) return false;

  const nextCov = coverageForDate(next, date);
  const prevCov = coverageForDate(prev, date);
  if (prevCov.runners < MIN_RUNNERS_FOR_CHECK) return false;
  if (prevCov.withOdds <= 0) return false;

  // Absolute rule: never go backwards on priced runners for the same day
  if (prevCov.withOdds > nextCov.withOdds) {
    const absoluteGain = prevCov.withOdds - nextCov.withOdds;
    const rateGain = prevCov.rate - nextCov.rate;
    if (nextCov.withOdds === 0) return true;
    if (absoluteGain >= 3) return true;
    if (rateGain >= 0.03) return true;
  }

  return false;
}

/**
 * Prefer richer same-day meetings from a prior export, while keeping the
 * latest calendar shell (labels, future days, model, performance).
 */
export function mergeKeptRacingCalendar(
  previous: RacingCalendarPayload,
  latest: RacingCalendarPayload
): RacingCalendarPayload {
  const date = latest.days[0]?.date;
  const prevDay = date
    ? previous.days.find((d) => d.date === date)
    : undefined;
  const prevCov = coverageForDate(previous, date);
  const nextCov = coverageForDate(latest, date);
  const prevExported = previous.exportedAt;

  const days =
    prevDay && date
      ? latest.days.map((d) =>
          d.date === date
            ? { ...d, meetings: prevDay.meetings, label: d.label || prevDay.label }
            : d
        )
      : previous.days;

  const keptSource =
    previous.source.includes("hrnet") || prevCov.withOdds > 0
      ? previous.source.includes("racing-api")
        ? "racing-api+hrnet"
        : previous.source
      : latest.source;
  const keptLabel =
    keptSource.includes("hrnet") || prevCov.rate >= ODDS_COVERAGE_HEALTHY
      ? "Live racecards"
      : latest.sourceLabel;

  return {
    ...latest,
    source: keptSource,
    sourceLabel: keptLabel,
    days,
    // Prefer tipsters/naps from the richer card when it was built for this date
    tipsters:
      previous.days[0]?.date === date && previous.tipsters?.length
        ? previous.tipsters
        : latest.tipsters,
    naps:
      previous.days[0]?.date === date && previous.naps?.length
        ? previous.naps
        : latest.naps,
    exportedAt: new Date().toISOString(),
    model: latest.model ?? previous.model,
    performance: latest.performance ?? previous.performance,
    enrichmentWarning:
      prevCov.rate < ODDS_COVERAGE_HEALTHY
        ? previous.enrichmentWarning ??
          `Live odds still limited (${prevCov.withOdds}/${prevCov.runners}) — kept last enrichment rather than overwriting with a worse scrape (${nextCov.withOdds}/${nextCov.runners}).`
        : undefined,
    servedPriorExport: true,
    priorExportNote:
      `Serving last racecards from ${prevExported} ` +
      `(${prevCov.withOdds}/${prevCov.runners} priced for ${date}) — this export only had ` +
      `${nextCov.withOdds}/${nextCov.runners} and was not allowed to overwrite.`,
    hrnDebug: [previous.hrnDebug, latest.hrnDebug].filter(Boolean).join(" | "),
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
  candidates: RacingCalendarPayload[],
  preferDate?: string
): RacingCalendarPayload | null {
  const usable = candidates.filter((c) => c?.days?.length);
  if (!usable.length) return null;
  return usable.reduce((best, cur) => {
    const date = preferDate ?? cur.days[0]?.date ?? best.days[0]?.date;
    const a = coverageForDate(best, date);
    const b = coverageForDate(cur, date);
    if (date && (a.withOdds > 0 || b.withOdds > 0)) {
      return b.withOdds > a.withOdds ? cur : best;
    }
    const a0 = calendarOddsCoverage(best);
    const b0 = calendarOddsCoverage(cur);
    return b0.withOdds > a0.withOdds ? cur : best;
  });
}

export async function loadPreviousRacingCalendar(
  localPath: string,
  preferDate?: string
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

  // Prefer the snapshot with the most live odds for the target date
  return pickRicherCalendar(
    [local, seed, live].filter((c): c is RacingCalendarPayload => c != null),
    preferDate
  );
}

const FORCED_SCRAPE_COOLDOWN_MS = 3 * 60 * 60 * 1000;

async function recentlyForcedScrape(isoDate: string): Promise<boolean> {
  try {
    const file = path.join(
      process.cwd(),
      ".cache",
      "racing-hrnet",
      `forced-attempt-${isoDate}.json`
    );
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { at?: number };
    return (
      typeof parsed.at === "number" &&
      Date.now() - parsed.at < FORCED_SCRAPE_COOLDOWN_MS
    );
  } catch {
    return false;
  }
}

async function markForcedScrape(isoDate: string): Promise<void> {
  try {
    const dir = path.join(process.cwd(), ".cache", "racing-hrnet");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `forced-attempt-${isoDate}.json`),
      JSON.stringify({ at: Date.now() }),
      "utf8"
    );
  } catch {
    // non-fatal
  }
}

/**
 * Hourly CI sets HRN_SKIP_SCRAPE to avoid Cloudflare/Tavily burn — but only
 * when we already have a healthy same-day card. Otherwise force a scrape so
 * a day rollover cannot stay stuck at 0 odds until a human re-seeds.
 * Forced retries are cooled down for 3h so a blocked CI IP cannot burn
 * Tavily every hour.
 */
export async function shouldSkipHrnScrape(isoDate: string): Promise<boolean> {
  if (process.env.HRN_SKIP_SCRAPE !== "true") return false;

  const prior = await loadPreviousRacingCalendar(
    publicCalendarPath(),
    isoDate
  );
  const cov = coverageForDate(
    prior ?? ({ days: [] } as unknown as RacingCalendarPayload),
    isoDate
  );
  if (isCalendarEnrichmentHealthy(cov)) {
    console.log(
      `  hrn cards: skip scrape for ${isoDate} — prior already has ${cov.withOdds}/${cov.runners} priced`
    );
    return true;
  }

  if (await recentlyForcedScrape(isoDate)) {
    console.warn(
      `  hrn cards: skip forced retry for ${isoDate} — already attempted within 3h ` +
        `(prior ${cov.withOdds}/${cov.runners || 0} priced)`
    );
    return true;
  }

  await markForcedScrape(isoDate);
  console.warn(
    `  hrn cards: forcing scrape for ${isoDate} despite HRN_SKIP_SCRAPE ` +
      `(prior ${cov.withOdds}/${cov.runners || 0} priced — below healthy bar)`
  );
  return false;
}

/** Persist a healthy calendar so the next CI run (and day rollover) can recover. */
export async function persistRacingCalendarSeed(
  calendar: RacingCalendarPayload
): Promise<boolean> {
  const cov = calendarOddsCoverage(calendar);
  if (cov.withOdds < MIN_SEED_ODDS || !isCalendarEnrichmentHealthy(cov)) {
    console.log(
      `  racing seed: not persisting (${cov.withOdds}/${cov.runners} priced)`
    );
    return false;
  }
  const out = racingCalendarSeedPath();
  await mkdir(path.dirname(out), { recursive: true });
  const seed: RacingCalendarPayload = {
    ...calendar,
    enrichmentWarning: undefined,
    servedPriorExport: undefined,
    priorExportNote: undefined,
  };
  await writeFile(out, JSON.stringify(seed), "utf8");
  console.log(
    `  racing seed: wrote ${out} (${cov.withOdds}/${cov.runners} priced for ${cov.date})`
  );
  return true;
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
