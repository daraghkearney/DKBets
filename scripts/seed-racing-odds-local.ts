/**
 * Run on a non-blocked IP (local machine) to scrape HorseRacing.net and
 * write a same-day calendar seed that CI can fall back to when Actions
 * IPs / Tavily cannot enrich odds.
 *
 * Usage: npx tsx scripts/seed-racing-odds-local.ts
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fetchHrnRacecards } from "../src/lib/horse-racing/hrnet";
import { mergeHrnIntoRaces } from "../src/lib/horse-racing/hrn-merge";
import { calendarOddsCoverage } from "../src/lib/horse-racing/calendar-quality";
import type { HorseRace, RacingCalendarPayload } from "../src/lib/horse-racing/types";

const LIVE_URL =
  process.env.RACING_CALENDAR_URL ||
  "https://statmanac.com/data/horse-racing/todays-races/calendar.json";

const OUT = path.join(
  process.cwd(),
  "data",
  "racing-cards",
  "calendar-seed.json"
);

async function main(): Promise<void> {
  console.log(`loading live calendar: ${LIVE_URL}`);
  const res = await fetch(LIVE_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`live calendar HTTP ${res.status}`);
  const calendar = (await res.json()) as RacingCalendarPayload;
  const today = calendar.days[0];
  if (!today) throw new Error("calendar has no days");

  const races: HorseRace[] = today.meetings.flatMap((m) => m.races);
  console.log(
    `today ${today.date}: ${races.length} races, scraping HorseRacing.net…`
  );

  const { races: hrn, stats } = await fetchHrnRacecards(today.date);
  console.log(
    `hrn: ${stats.parsed}/${stats.links} (${stats.fetchMode}), merging…`
  );

  const { races: mergedRaces, runners: um } = mergeHrnIntoRaces(races, hrn);
  console.log(`merged ${mergedRaces}/${races.length} races, ${um} runners`);

  const before = calendarOddsCoverage(calendar);
  const seeded: RacingCalendarPayload = {
    ...calendar,
    source: "racing-api+hrnet",
    sourceLabel: "Live racecards",
    exportedAt: new Date().toISOString(),
    enrichmentWarning: undefined,
    hrnDebug: `${today.date}: local seed ${stats.parsed}/${stats.links} (${stats.fetchMode}), merged ${um} runners`,
    servedPriorExport: undefined,
    priorExportNote: undefined,
  };
  const after = calendarOddsCoverage(seeded);
  console.log(
    `odds coverage: ${before.withOdds}/${before.runners} → ${after.withOdds}/${after.runners}`
  );

  if (after.withOdds < 50) {
    throw new Error(
      `seed too thin (${after.withOdds}/${after.runners}) — refusing to write`
    );
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(seeded), "utf8");
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
