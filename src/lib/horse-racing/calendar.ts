import { courseSlug, racingWeekDays } from "./dates";
import { fetchRacecardsForDate, isRacingApiConfigured } from "./racing-api";
import { fetchTipsterIntelligence } from "./tipster-research";
import { applyModel } from "./model";
import { learnFromYesterday, savePredictionLog } from "./results-learning";
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
  let source = "demo+web";
  let sourceLabel = "Demo cards + Tavily tipsters";
  let anyLive = false;

  if (isRacingApiConfigured()) {
    for (const day of week) {
      console.log(`  racing calendar: ${day.date} (${day.label}) …`);
      const result = await fetchRacecardsForDate(day.date, day.offset);
      debugNotes.push(`${day.date}: ${result.debug}`);

      let races: HorseRace[] = result.races.map((r) => ({
        ...r,
        date: day.date,
      }));
      if (!races.length && day.offset === 0) {
        races = demoRacesForDate(day.date);
      }
      if (result.races.length) anyLive = true;

      days.push({
        date: day.date,
        label: day.label,
        meetings: groupByMeeting(races),
      });

      await new Promise((r) => setTimeout(r, 400));
    }
  } else {
    for (const day of week) {
      const races =
        day.offset === 0 ? demoRacesForDate(day.date) : [];
      days.push({
        date: day.date,
        label: day.label,
        meetings: groupByMeeting(races),
      });
    }
    debugNotes.push("no credentials");
  }

  if (anyLive) {
    source = "racing-api";
    sourceLabel = "The Racing API + Tavily";
  }

  const todayIso = week[0]?.date;
  const tipsterDay = days.find((d) => d.date === todayIso) ?? days[0];
  const todayRaces =
    tipsterDay?.meetings.flatMap((m) => m.races) ?? [];
  const raceIds = todayRaces.map((r) => r.id);
  const courses = [...new Set(todayRaces.map((r) => r.course))].filter(Boolean);

  const tipsters = await fetchTipsterIntelligence("todays-races", raceIds, {
    courses,
  });

  // Apply learned weights + tipster boosts to every day's cards
  for (const day of days) {
    for (const meeting of day.meetings) {
      applyModel(meeting.races, tipsters, model.weights);
      meeting.races.forEach((race) =>
        race.runners.sort((a, b) => b.overallScore - a.overallScore)
      );
    }
  }

  // Log today's predictions so tomorrow's run can learn from results
  if (todayIso && todayRaces.some((r) => !r.id.startsWith("demo-"))) {
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
