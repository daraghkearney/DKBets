import { courseSlug, racingWeekDays } from "./dates";
import { fetchRacecardsForDate, isRacingApiConfigured } from "./racing-api";
import { fetchTipsterIntelligence } from "./tipster-research";
import { applyModel } from "./model";
import { loadPeopleStats } from "./people-stats";
import { learnFromYesterday, savePredictionLog } from "./results-learning";
import { fetchHrnRacecards } from "./hrnet";
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

    const needsHrn =
      day.offset <= 1 &&
      (!races.length ||
        races.every((r) => r.id.startsWith("demo-") || !r.runners.length));

    if (needsHrn) {
      try {
        const hrn = await fetchHrnRacecards(day.date);
        if (hrn.length) {
          anyHrn = true;
          if (races.length && races.some((r) => r.runners.length)) {
            mergeHrnIntoRaces(races, hrn);
            console.log(
              `  hrn merge: ${day.date} — enriched API cards (${hrn.length} scraped races)`
            );
          } else {
            races = racesFromHrn(hrn, day.date);
            console.log(
              `  hrn cards: ${day.date} — built ${races.length} races from scrape`
            );
          }
        }
      } catch (e) {
        console.warn(`  hrn cards: failed for ${day.date}`, e);
      }
    } else if (day.offset <= 1 && races.length) {
      try {
        const hrn = await fetchHrnRacecards(day.date);
        if (hrn.length) {
          anyHrn = true;
          const matched = mergeHrnIntoRaces(races, hrn);
          console.log(
            `  hrn merge: ${day.date} — enriched ${matched}/${races.length} races`
          );
        }
      } catch (e) {
        console.warn(`  hrn merge: failed for ${day.date}`, e);
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
      meeting.races.forEach((race) =>
        race.runners.sort((a, b) => b.overallScore - a.overallScore)
      );
    }
  }

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
  };
}
