/**
 * Run on a non-blocked IP (local machine) to scrape HorseRacing.net and
 * write a same-day calendar seed that CI can fall back to when Actions
 * IPs / Tavily cannot enrich odds.
 *
 * Enriches today AND tomorrow so the first hourly deploy after midnight
 * still has priced runners without needing a fresh scrape.
 *
 * Usage: npx tsx scripts/seed-racing-odds-local.ts
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fetchHrnRacecards, hrnLinksFromRaces } from "../src/lib/horse-racing/hrnet";
import { mergeHrnIntoRaces } from "../src/lib/horse-racing/hrn-merge";
import {
  calendarOddsCoverage,
  coverageForDate,
} from "../src/lib/horse-racing/calendar-quality";
import { courseSlug } from "../src/lib/horse-racing/dates";
import { computeOverall } from "../src/lib/horse-racing/form-analysis";
import { calibrateRaceProbabilities } from "../src/lib/horse-racing/probability";
import type {
  HorseRace,
  RacingCalendarPayload,
} from "../src/lib/horse-racing/types";

const LIVE_URL =
  process.env.RACING_CALENDAR_URL ||
  "https://statmanac.com/data/horse-racing/todays-races/calendar.json";

const OUT = path.join(
  process.cwd(),
  "data",
  "racing-cards",
  "calendar-seed.json"
);

async function enrichDay(
  calendar: RacingCalendarPayload,
  dayIndex: number
): Promise<{ mergedRaces: number; runners: number; parsed: number; links: number; mode: string }> {
  const day = calendar.days[dayIndex];
  if (!day) return { mergedRaces: 0, runners: 0, parsed: 0, links: 0, mode: "none" };

  const races: HorseRace[] = day.meetings.flatMap((m) => m.races);
  if (!races.length) {
    console.log(`day ${day.date}: no races to enrich`);
    return { mergedRaces: 0, runners: 0, parsed: 0, links: 0, mode: "none" };
  }

  console.log(
    `${day.date}: ${races.length} races, scraping HorseRacing.net…`
  );

  const courseFilter = [...new Set(races.map((r) => courseSlug(r.course)))];
  const seedLinks = hrnLinksFromRaces(races);
  const { races: hrn, stats } = await fetchHrnRacecards(
    day.date,
    courseFilter,
    seedLinks
  );
  console.log(
    `hrn ${day.date}: ${stats.parsed}/${stats.links} (${stats.fetchMode}), merging…`
  );

  const { races: mergedRaces, runners: um } = mergeHrnIntoRaces(races, hrn);
  console.log(
    `merged ${day.date}: ${mergedRaces}/${races.length} races, ${um} runners`
  );

  // Re-rank with updated market (and other) factor scores so the seed
  // isn't stuck on pre-enrichment overalls / win probs.
  for (const race of races) {
    for (const runner of race.runners) {
      runner.overallScore = computeOverall(runner);
    }
    race.runners.sort((a, b) => b.overallScore - a.overallScore);
    race.runners.forEach((r, i) => {
      r.predictedRank = i + 1;
    });
    calibrateRaceProbabilities(race);
  }

  return {
    mergedRaces,
    runners: um,
    parsed: stats.parsed,
    links: stats.links,
    mode: stats.fetchMode,
  };
}

async function main(): Promise<void> {
  console.log(`loading live calendar: ${LIVE_URL}`);
  const res = await fetch(LIVE_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`live calendar HTTP ${res.status}`);
  const calendar = (await res.json()) as RacingCalendarPayload;
  if (!calendar.days[0]) throw new Error("calendar has no days");

  const before = calendarOddsCoverage(calendar);
  const notes: string[] = [];

  // Today + tomorrow — tomorrow protects the midnight rollover
  for (const idx of [0, 1]) {
    if (!calendar.days[idx]?.meetings.length) continue;
    const result = await enrichDay(calendar, idx);
    if (result.runners > 0) {
      notes.push(
        `${calendar.days[idx]!.date}: local seed ${result.parsed}/${result.links} (${result.mode}), merged ${result.runners} runners`
      );
    }
  }

  const today = calendar.days[0]!;
  const tomorrow = calendar.days[1];
  const afterToday = coverageForDate(calendar, today.date);
  const afterTomorrow = tomorrow
    ? coverageForDate(calendar, tomorrow.date)
    : null;

  console.log(
    `odds coverage today: ${before.withOdds}/${before.runners} → ${afterToday.withOdds}/${afterToday.runners}`
  );
  if (afterTomorrow) {
    console.log(
      `odds coverage tomorrow (${tomorrow!.date}): ${afterTomorrow.withOdds}/${afterTomorrow.runners}`
    );
  }

  if (afterToday.withOdds < 50) {
    throw new Error(
      `seed too thin (${afterToday.withOdds}/${afterToday.runners}) — refusing to write`
    );
  }

  const seeded: RacingCalendarPayload = {
    ...calendar,
    source: "racing-api+hrnet",
    sourceLabel: "Live racecards",
    exportedAt: new Date().toISOString(),
    enrichmentWarning: undefined,
    hrnDebug: notes.join(" | ") || undefined,
    servedPriorExport: undefined,
    priorExportNote: undefined,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(seeded), "utf8");
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
