import { courseSlug, racingWeekDays } from "./dates";
import { fetchRacecardsForDate, isRacingApiConfigured } from "./racing-api";
import { fetchTipsterIntelligence } from "./tipster-research";
import { applyModel, augmentSignalHotTips } from "./model";
import { pickEachWayGem } from "./each-way";
import { loadPeopleStats } from "./people-stats";
import { learnFromYesterday, savePredictionLog } from "./results-learning";
import { fetchHrnRacecards, hrnLinksFromRaces } from "./hrnet";
import {
  buildHrnTipsterPicks,
  mergeHrnIntoRaces,
  racesFromHrn,
} from "./hrn-merge";
import type { TipsterPick } from "./types";
import type {
  HorseRace,
  RacingCalendarDay,
  RacingCalendarPayload,
  RacingMeeting,
} from "./types";

function groupByMeeting(races: HorseRace[]): RacingMeeting[] {
  const map = new Map<string, RacingMeeting>();
  for (const race of races) {
    const name = race.course || "Unknown";
    const id = courseSlug(name);
    const existing = map.get(id);
    if (existing) {
      existing.races.push(race);
    } else {
      map.set(id, { id, name, races: [race] });
    }
  }
  return [...map.values()]
    .map((m) => ({
      ...m,
      races: m.races.sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function demoRacesForDate(date: string): HorseRace[] {
  return [
    {
      id: `demo-${date}-r1`,
      date,
      time: "13:30",
      name: "Maiden Hurdle",
      course: "Leopardstown",
      distance: "2m 4f",
      distanceYards: 4400,
      going: "Good to Soft",
      raceClass: "Class 3",
      runners: [],
    },
  ];
}

export async function buildRacingCalendarPayload(): Promise<RacingCalendarPayload> {
  // Learn from yesterday's results BEFORE scoring today, so today's
  // predictions use the freshest weights.
  const { model, review } = await learnFromYesterday();
  console.log(
    `  racing model: weights ${Object.entries(model.weights)
      .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
      .join(" ")} (${model.samples} samples)`
  );

  const week = racingWeekDays();
  const days: RacingCalendarDay[] = [];
  const debugNotes: string[] = [];
  let source = "hrnet";
  let sourceLabel = "HorseRacing.net";
  let anyLive = false;
  let anyHrn = false;
  const hrnNotes: string[] = [];

  for (const day of week) {
    console.log(`  racing calendar: ${day.date} (${day.label}) …`);
    let races: HorseRace[] = [];

    if (isRacingApiConfigured()) {
      const result = await fetchRacecardsForDate(day.date, day.offset);
      debugNotes.push(`${day.date}: ${result.debug}`);
      races = result.races.map((r) => ({ ...r, date: day.date }));
      if (result.races.length) anyLive = true;
      await new Promise((r) => setTimeout(r, 400));
    } else {
      debugNotes.push(`${day.date}: no racing API credentials`);
    }

    if (day.offset <= 1) {
      try {
        const courseFilter = races.length
          ? [...new Set(races.map((r) => courseSlug(r.course)))]
          : undefined;
        const seedLinks = races.length ? hrnLinksFromRaces(races) : undefined;
        const { races: hrn, stats: hrnStats } = await fetchHrnRacecards(
          day.date,
          courseFilter,
          seedLinks
        );
        if (hrn.length) {
          anyHrn = true;
          if (races.length && races.some((r) => r.runners.length)) {
            const { races: rm, runners: um } = mergeHrnIntoRaces(races, hrn);
            const scrapeNote = `scraped ${hrnStats.parsed}/${hrnStats.links} (${hrnStats.fetchMode}${hrnStats.cached ? `, ${hrnStats.cached} cached` : ""})`;
            hrnNotes.push(
              `${day.date}: ${rm}/${races.length} merged, ${um} runners · ${scrapeNote}`
            );
            console.log(
              `  hrn merge: ${day.date} — ${rm}/${races.length} races, ${um} runners`
            );
          } else {
            races = racesFromHrn(hrn, day.date);
            hrnNotes.push(`${day.date}: built ${races.length} races from scrape`);
            console.log(
              `  hrn cards: ${day.date} — built ${races.length} races from scrape`
            );
          }
        } else {
          hrnNotes.push(
            `${day.date}: scrape 0/${hrnStats.links} (${hrnStats.fetchMode})` +
              (hrnStats.failedSamples.length
                ? ` · failed: ${hrnStats.failedSamples.join(", ")}`
                : "")
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        hrnNotes.push(`${day.date}: failed (${msg})`);
        console.warn(`  hrn cards: failed for ${day.date}`, e);
      }
    }

    if (!races.length && day.offset === 0) {
      races = demoRacesForDate(day.date);
    }

    days.push({
      date: day.date,
      label: day.label,
      meetings: groupByMeeting(races),
    });
  }

  if (anyLive && anyHrn) {
    source = "racing-api+hrnet";
    sourceLabel = "The Racing API + HorseRacing.net";
  } else if (anyLive) {
    source = "racing-api";
    sourceLabel = "The Racing API + Tavily";
  } else if (anyHrn) {
    source = "hrnet";
    sourceLabel = "HorseRacing.net";
  } else {
    source = "demo+web";
    sourceLabel = "Demo cards";
  }

  const hrnPicks: TipsterPick[] = [];
  for (const day of days.slice(0, 2)) {
    const dayRaces = day.meetings.flatMap((m) => m.races);
    if (dayRaces.some((r) => r.runners.length)) {
      hrnPicks.push(...buildHrnTipsterPicks(dayRaces));
    }
  }
  console.log(`  hrn tips: ${hrnPicks.length} press/verdict picks`);

  const todayIso = week[0]?.date;
  const tipsterDay = days.find((d) => d.date === todayIso) ?? days[0];
  const todayRaces =
    tipsterDay?.meetings.flatMap((m) => m.races) ?? [];
  const raceIds = todayRaces.map((r) => r.id);
  const courses = [...new Set(todayRaces.map((r) => r.course))].filter(Boolean);
  const runnerNames = todayRaces.flatMap((r) =>
    r.runners.map((x) => x.name)
  );

  const webPicks = await fetchTipsterIntelligence("todays-races", raceIds, {
    courses,
    runnerNames,
  });
  const tipsters = [...hrnPicks, ...webPicks];

  // Apply strike rates, learned weights and tipster boosts to every day
  const peopleStats = await loadPeopleStats();
  for (const day of days) {
    for (const meeting of day.meetings) {
      applyModel(meeting.races, tipsters, model.weights, peopleStats);
      for (const race of meeting.races) {
        const gem = pickEachWayGem(race);
        if (gem) race.eachWayGem = gem;
        race.runners.sort((a, b) => b.overallScore - a.overallScore);
      }
    }
  }
  augmentSignalHotTips(days, tipsters);

  // Log today's predictions so tomorrow's run can learn from results
  if (todayIso && todayRaces.some((r) => r.runners.length)) {
    try {
      await savePredictionLog(todayIso, todayRaces);
      console.log(
        `  racing model: logged predictions for ${todayRaces.length} races (${todayIso})`
      );
    } catch (e) {
      console.warn("  racing model: failed to log predictions", e);
    }
  }

  return {
    source,
    sourceLabel,
    exportedAt: new Date().toISOString(),
    racingApiDebug: debugNotes.join(" | "),
    days: days.map(({ date, label, meetings }) => ({ date, label, meetings })),
    tipsters,
    model,
    review,
    hrnDebug: hrnNotes.join(" | ") || undefined,
  };
}
