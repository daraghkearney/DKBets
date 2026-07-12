import type { HorseRace, HorseRunner } from "./types";

const SOFTMAX_TEMP = 3.2;

/** Convert heuristic scores to race-normalised win probabilities. */
export function calibrateRaceProbabilities(race: HorseRace): void {
  const runners = race.runners.filter((r) => r.overallScore > 0);
  if (runners.length < 2) return;

  const exps = runners.map((r) => Math.exp(r.overallScore * SOFTMAX_TEMP));
  const sum = exps.reduce((a, b) => a + b, 0);
  if (!sum) return;

  for (let i = 0; i < runners.length; i++) {
    const r = runners[i];
    r.winProbability = exps[i] / sum;
    if (r.odds != null && r.odds > 1) {
      r.impliedProbability = 1 / r.odds;
      r.modelEdge = r.winProbability / r.impliedProbability;
    } else {
      r.impliedProbability = undefined;
      r.modelEdge = undefined;
    }
  }
}

export function topRunnerScoreGap(race: HorseRace): number {
  const sorted = [...race.runners].sort(
    (a, b) => b.overallScore - a.overallScore
  );
  if (sorted.length < 2) return 0;
  return sorted[0].overallScore - sorted[1].overallScore;
}

export function topRunner(race: HorseRace): HorseRunner | undefined {
  return [...race.runners].sort((a, b) => b.overallScore - a.overallScore)[0];
}
