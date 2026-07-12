import { calibrateRaceProbabilities, topRunner, topRunnerScoreGap } from "./probability";
import type { HorseRace, RacingNapPick } from "./types";

const MIN_EDGE = 1.12;
const STRONG_EDGE = 1.25;
const MIN_SCORE_GAP = 0.055;
const MIN_MODEL_PROB = 0.12;
const MAX_NAPS = 6;

function napRationale(
  runner: HorseRace["runners"][number],
  gap: number
): string[] {
  const lines: string[] = [];
  if (runner.modelEdge != null && runner.modelEdge >= STRONG_EDGE) {
    lines.push(
      `Value edge ${runner.modelEdge.toFixed(2)}× vs market (${Math.round((runner.winProbability ?? 0) * 100)}% model vs ${Math.round((runner.impliedProbability ?? 0) * 100)}% implied)`
    );
  } else if (runner.modelEdge != null) {
    lines.push(`Modest value edge ${runner.modelEdge.toFixed(2)}× vs SP`);
  }
  if (gap >= 0.08) lines.push(`Clear model leader (+${Math.round(gap * 100)} pts vs 2nd)`);
  if (runner.tipsterScore >= 0.8) lines.push("Backed by high-strike-rate tipster intel");
  if (runner.topspeed != null && runner.topspeedScore >= 0.75) {
    lines.push(`Strong topspeed figure (${runner.topspeed})`);
  }
  if (runner.drawScore >= 0.75) {
    const drawNote = runner.notes.find((n) => /draw/i.test(n));
    if (drawNote) lines.push(drawNote);
  }
  return lines.slice(0, 4);
}

function passesNapGates(
  runner: HorseRace["runners"][number],
  gap: number
): boolean {
  if ((runner.winProbability ?? 0) < MIN_MODEL_PROB) return false;
  if (gap < MIN_SCORE_GAP) return false;

  const edge = runner.modelEdge;
  const isFav = runner.odds != null && runner.odds <= 3.5;

  if (edge != null) {
    if (isFav && edge < STRONG_EDGE) return false;
    if (edge < MIN_EDGE) return false;
    return true;
  }

  // No odds — require strong model separation + tipster or topspeed support
  if (gap < 0.09) return false;
  return runner.tipsterScore >= 0.75 || runner.topspeedScore >= 0.78;
}

/**
 * Annotate races with calibrated probabilities and return today's selective nap list.
 */
export function buildValuePicks(
  races: HorseRace[],
  date: string,
  maxNaps = MAX_NAPS
): RacingNapPick[] {
  const candidates: RacingNapPick[] = [];

  for (const race of races) {
    if (race.runners.length < 4) continue;
    calibrateRaceProbabilities(race);

    const leader = topRunner(race);
    if (!leader || leader.predictedRank !== 1) continue;

    const gap = topRunnerScoreGap(race);
    if (!passesNapGates(leader, gap)) continue;

    const edge = leader.modelEdge ?? 1;
    const confidence: RacingNapPick["confidence"] =
      edge >= STRONG_EDGE && gap >= 0.07 ? "high" : "medium";

    candidates.push({
      raceId: race.id,
      date,
      time: race.time,
      course: race.course,
      raceName: race.name,
      horse: leader.name,
      runnerId: leader.id,
      odds: leader.odds,
      modelProb: leader.winProbability ?? 0,
      impliedProb: leader.impliedProbability ?? 0,
      edge,
      scoreGap: gap,
      rationale: napRationale(leader, gap),
      confidence,
    });
  }

  return candidates
    .sort((a, b) => b.edge * b.scoreGap - a.edge * a.scoreGap)
    .slice(0, maxNaps);
}
