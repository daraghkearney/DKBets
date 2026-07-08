import { distanceYards, enrichRunner } from "./form-analysis";
import { fetchLiveRacecards, isRacingApiConfigured } from "./racing-api";
import { fetchTipsterIntelligence } from "./tipster-research";
import type { HorseRace, HorseRacingPayload } from "./types";

/** Demo racecards when Racing API credentials are absent. */
function demoRaces(meeting: string): HorseRace[] {
  const course =
    meeting === "cheltenham"
      ? "Cheltenham"
      : meeting === "punchestown"
        ? "Punchestown"
        : "Leopardstown";

  const races: HorseRace[] = [
    {
      id: `${meeting}-r1`,
      time: "13:30",
      name: "Maiden Hurdle",
      course,
      distance: "2m 4f",
      distanceYards: distanceYards("2m 4f"),
      going: "Good to Soft",
      raceClass: "Class 3",
      runners: [],
    },
    {
      id: `${meeting}-r2`,
      time: "14:05",
      name: "Handicap Chase",
      course,
      distance: "3m 1f",
      distanceYards: distanceYards("3m 1f"),
      going: "Good to Soft",
      raceClass: "Class 2",
      runners: [],
    },
  ];

  const runners = [
    {
      id: "h1",
      name: "Golden Trail",
      age: 6,
      weight: "11-10",
      jockey: "P. Townend",
      trainer: "W. Mullins",
      form: "121-3",
      odds: 3.5,
      formRuns: [
        {
          date: "2026-03-12",
          course,
          distance: "2m 4f",
          distanceYards: distanceYards("2m 4f"),
          going: "Soft",
          position: 1,
          runners: 12,
          jockey: "P. Townend",
          trainer: "W. Mullins",
          weight: "11-7",
          odds: "5/2",
          comment: "Travelled well, quickened clear",
        },
      ],
    },
    {
      id: "h2",
      name: "Storm Catcher",
      age: 5,
      weight: "11-3",
      jockey: "R. Walsh",
      trainer: "G. Elliott",
      form: "3-412",
      odds: 6.0,
      formRuns: [],
    },
  ];

  for (const race of races) {
    race.runners = runners.map((r) =>
      enrichRunner(
        { ...r, id: `${race.id}-${r.id}` },
        race.course,
        race.distanceYards
      )
    );
  }

  return races;
}

const MEETING_LABELS: Record<string, string> = {
  "todays-races": "Today's Races · UK & Ireland",
  cheltenham: "Cheltenham Festival",
  punchestown: "Punchestown Festival",
  aintree: "Aintree · Grand National",
};

export async function buildHorseRacingPayload(
  meeting: string
): Promise<HorseRacingPayload> {
  let races: HorseRace[] | null = null;
  let source = "demo+web";
  let sourceLabel = "Demo cards + Tavily tipsters";
  let racingApiDebug: string | undefined;

  if (isRacingApiConfigured()) {
    console.log(`  racing api: fetching live cards for ${meeting} …`);
    const result = await fetchLiveRacecards(meeting);
    racingApiDebug = result.debug;
    if (result.races.length) {
      races = result.races;
      source = "racing-api";
      sourceLabel = "The Racing API + Tavily";
      console.log(`  racing api: ${races.length} live races for ${meeting}`);
    } else {
      console.warn(`  racing api: no races for ${meeting} — ${result.debug}`);
    }
  }

  if (!races?.length) {
    races = demoRaces(meeting);
  }

  const raceIds = races.map((r) => r.id);
  const tipsters = await fetchTipsterIntelligence(meeting, raceIds);

  const topRunners = races
    .flatMap((r) => r.runners)
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 3);

  return {
    meeting,
    meetingLabel: MEETING_LABELS[meeting] ?? meeting,
    date: new Date().toISOString().slice(0, 10),
    source,
    sourceLabel,
    exportedAt: new Date().toISOString(),
    races,
    tipsters,
    researchSummary: `${races.length} races · ${source === "racing-api" ? "live cards" : "demo"} · ${tipsters.length} tipster signals · top: ${topRunners.map((r) => r.name).join(", ") || "pending"}`,
    racingApiDebug,
  };
}
