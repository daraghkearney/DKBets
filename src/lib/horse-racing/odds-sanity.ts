/**
 * Guardrails for live racing prices.
 * The Racing API free tier often stamps every runner with 1.20 / 1.25, which
 * then looks "priced" to skip-scrape / keep-last-good logic. A real win
 * market never looks like that.
 */
import type { HorseRace, HorseRunner } from "./types";

const DUMMY_DECIMALS = new Set([1.01, 1.11, 1.2, 1.25]);

export function isLiveDecimalOdds(
  odds: number | null | undefined
): boolean {
  return odds != null && Number.isFinite(odds) && odds > 1 && odds <= 501;
}

function rounded(odds: number): number {
  return Math.round(odds * 100) / 100;
}

/** True when a race's prices look like a real book, not API placeholders. */
export function raceOddsArePlausible(
  odds: Array<number | null | undefined>
): boolean {
  const live = odds.filter(isLiveDecimalOdds) as number[];
  if (live.length < 2) return live.length > 0;

  const unique = new Set(live.map(rounded));
  const dummyCount = live.filter((o) => DUMMY_DECIMALS.has(rounded(o))).length;
  if (live.length >= 5 && dummyCount / live.length >= 0.65) return false;
  if (live.length >= 5 && unique.size <= 2) return false;

  const overround = live.reduce((sum, o) => sum + 1 / o, 0);
  if (overround > 2.4) return false;
  return true;
}

export function raceHasPlausibleOdds(race: HorseRace): boolean {
  return raceOddsArePlausible(race.runners.map((r) => r.odds));
}

function clearDummyOdds(runner: HorseRunner): HorseRunner {
  if (runner.odds == null) return runner;
  return {
    ...runner,
    odds: null,
    marketScore: 0.45,
    impliedProbability: undefined,
    modelEdge: undefined,
    notes: runner.notes.filter((n) => !n.startsWith("Strong market support")),
  };
}

/** Drop placeholder prices so they cannot poison the model or skip-scrape. */
export function stripImplausibleRaceOdds(race: HorseRace): HorseRace {
  if (raceHasPlausibleOdds(race)) return race;
  return {
    ...race,
    runners: race.runners.map(clearDummyOdds),
  };
}

export function stripImplausibleRaces(races: HorseRace[]): HorseRace[] {
  return races.map(stripImplausibleRaceOdds);
}

export function countPlausiblePricedRunners(races: HorseRace[]): {
  runners: number;
  withOdds: number;
} {
  let runners = 0;
  let withOdds = 0;
  for (const race of races) {
    runners += race.runners.length;
    if (!raceHasPlausibleOdds(race)) continue;
    for (const r of race.runners) {
      if (isLiveDecimalOdds(r.odds)) withOdds += 1;
    }
  }
  return { runners, withOdds };
}
