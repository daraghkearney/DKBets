import { distanceYards, enrichRunner } from "./form-analysis";
import { fetchTipsterIntelligence } from "./tipster-research";
import type { HorseRace, HorseRacingPayload } from "./types";

/** Demo racecards — replace with Racing API when key is configured. */
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
        {
          date: "2026-02-20",
          course: "Fairyhouse",
          distance: "2m 6f",
          distanceYards: distanceYards("2m 6f"),
          going: "Heavy",
          position: 2,
          runners: 14,
          jockey: "P. Townend",
          trainer: "W. Mullins",
          weight: "11-5",
          odds: "7/2",
          comment: "Stayed on strongly",
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
      formRuns: [
        {
          date: "2026-03-01",
          course,
          distance: "3m 1f",
          distanceYards: distanceYards("3m 1f"),
          going: "Good",
          position: 3,
          runners: 16,
          jockey: "R. Walsh",
          trainer: "G. Elliott",
          weight: "11-0",
          odds: "9/2",
          comment: "Kept on one pace",
        },
      ],
    },
    {
      id: "h3",
      name: "Midnight Echo",
      age: 7,
      weight: "10-12",
      jockey: "D. Mullins",
      trainer: "H. de Bromhead",
      form: "2-155",
      odds: 12.0,
      formRuns: [
        {
          date: "2026-01-15",
          course: "Punchestown",
          distance: "2m 4f",
          distanceYards: distanceYards("2m 4f"),
          going: "Yielding",
          position: 2,
          runners: 18,
          jockey: "D. Mullins",
          trainer: "H. de Bromhead",
          weight: "10-10",
          odds: "14/1",
          comment: "Ran huge from rear",
        },
      ],
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
  const races = demoRaces(meeting);
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
    source: process.env.RACING_API_KEY ? "racing-api" : "demo+web",
    sourceLabel: process.env.RACING_API_KEY
      ? "The Racing API + Tavily"
      : "Demo cards + Tavily tipsters",
    exportedAt: new Date().toISOString(),
    races,
    tipsters,
    researchSummary: `${races.length} races analysed · ${tipsters.length} tipster signals · top form scores: ${topRunners.map((r) => r.name).join(", ") || "pending"}`,
  };
}
