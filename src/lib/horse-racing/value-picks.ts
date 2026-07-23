import {
  calibrateRaceProbabilities,
  topRunner,
  topRunnerScoreGap,
} from "./probability";
import type { HorseRace, RacingNapPick } from "./types";

/** Nap-tier (most selective, capped per day). */
const NAP_MIN_EDGE = 1.12;
const NAP_STRONG_EDGE = 1.25;
const NAP_MIN_SCORE_GAP = 0.055;
const NAP_MIN_MODEL_PROB = 0.12;
const MAX_NAPS = 6;

/**
 * Confident #1 tier — between loose ranking and naps.
 * These are the picks that feed the headline win-rate KPI.
 */
const CONF_MIN_EDGE = 1.08;
const CONF_FAV_EDGE = 1.18;
const CONF_MIN_SCORE_GAP = 0.04;
const CONF_MIN_MODEL_PROB = 0.13;
const CONF_FAV_ODDS = 3.5;

function supportSignal(runner: HorseRace["runners"][number]): boolean {
  return (
    runner.tipsterScore >= 0.7 ||
    runner.topspeedScore >= 0.72 ||
    runner.recentFormScore >= 0.7 ||
    runner.courseFitScore >= 0.72 ||
    runner.distanceFitScore >= 0.72
  );
}

function napRationale(
  runner: HorseRace["runners"][number],
  gap: number
): string[] {
  const lines: string[] = [];
  if (runner.modelEdge != null && runner.modelEdge >= NAP_STRONG_EDGE) {
    lines.push(
      `Value edge ${runner.modelEdge.toFixed(2)}× vs market (${Math.round((runner.winProbability ?? 0) * 100)}% model vs ${Math.round((runner.impliedProbability ?? 0) * 100)}% implied)`
    );
  } else if (runner.modelEdge != null) {
    lines.push(`Modest value edge ${runner.modelEdge.toFixed(2)}× vs SP`);
  }
  if (gap >= 0.08) {
    lines.push(`Clear model leader (+${Math.round(gap * 100)} pts vs 2nd)`);
  }
  if (runner.tipsterScore >= 0.8) {
    lines.push("Backed by high-strike-rate tipster intel");
  }
  if (runner.topspeed != null && runner.topspeedScore >= 0.75) {
    lines.push(`Strong topspeed figure (${runner.topspeed})`);
  }
  if (runner.drawScore >= 0.75) {
    const drawNote = runner.notes.find((n) => /draw/i.test(n));
    if (drawNote) lines.push(drawNote);
  }
  return lines.slice(0, 4);
}

/** True when the model is genuinely confident in this race's #1. */
export function passesConfidentGates(
  runner: HorseRace["runners"][number],
  gap: number,
  fieldSize: number
): boolean {
  if (fieldSize < 4) return false;
  if (runner.odds == null || runner.odds <= 1) return false;
  if ((runner.winProbability ?? 0) < CONF_MIN_MODEL_PROB) return false;
  if (gap < CONF_MIN_SCORE_GAP) return false;

  const edge = runner.modelEdge;
  if (edge == null) return false;

  const isFav = runner.odds <= CONF_FAV_ODDS;

  if (isFav) {
    if (edge >= CONF_FAV_EDGE && gap >= CONF_MIN_SCORE_GAP) return true;
    // Short-priced only if clear separation + supporting form/tips
    return (
      edge >= 1.12 &&
      gap >= 0.07 &&
      (runner.winProbability ?? 0) >= 0.22 &&
      supportSignal(runner)
    );
  }

  // Longer prices: need real edge vs market
  if (edge >= CONF_MIN_EDGE && gap >= CONF_MIN_SCORE_GAP) return true;

  // Strong separation with form/tipster support can still qualify at thin edge
  return edge >= 1.05 && gap >= 0.075 && supportSignal(runner);
}

function passesNapGates(
  runner: HorseRace["runners"][number],
  gap: number
): boolean {
  if ((runner.winProbability ?? 0) < NAP_MIN_MODEL_PROB) return false;
  if (gap < NAP_MIN_SCORE_GAP) return false;

  const edge = runner.modelEdge;
  const isFav = runner.odds != null && runner.odds <= CONF_FAV_ODDS;

  if (edge != null) {
    if (isFav && edge < NAP_STRONG_EDGE) return false;
    if (edge < NAP_MIN_EDGE) return false;
    return true;
  }

  // Naps without odds are rare — require strong separation + support
  if (gap < 0.09) return false;
  return runner.tipsterScore >= 0.75 || runner.topspeedScore >= 0.78;
}

/**
 * Tag every race: standard ranking always exists; confident / nap when gates pass.
 * Call after applyModel (probabilities already calibrated there).
 */
export function annotateRacePickTiers(races: HorseRace[]): void {
  for (const race of races) {
    if (race.runners.length < 2) {
      race.topPickConfidence = "standard";
      continue;
    }

    calibrateRaceProbabilities(race);
    const leader = topRunner(race);
    if (!leader) {
      race.topPickConfidence = "standard";
      continue;
    }

    const gap = topRunnerScoreGap(race);
    race.topPickConfidence = passesConfidentGates(
      leader,
      gap,
      race.runners.length
    )
      ? "confident"
      : "standard";

    if (leader.winProbability != null) {
      race.topPick = {
        runnerId: leader.id,
        name: leader.name,
        odds: leader.odds,
        modelProb: leader.winProbability,
        edge: leader.modelEdge ?? 1,
        confidence: race.topPickConfidence,
      };
    }
  }
}

/**
 * Selective nap list (subset of confident picks). Also upgrades matching
 * races to `topPickConfidence: "nap"`.
 */
export function buildValuePicks(
  races: HorseRace[],
  date: string,
  maxNaps = MAX_NAPS
): RacingNapPick[] {
  annotateRacePickTiers(races);

  const candidates: RacingNapPick[] = [];

  for (const race of races) {
    if (race.runners.length < 4) continue;

    const leader = topRunner(race);
    if (!leader || leader.predictedRank !== 1) continue;

    const gap = topRunnerScoreGap(race);
    // Naps must clear confident gates first, then stricter nap gates
    if (!passesConfidentGates(leader, gap, race.runners.length)) continue;
    if (!passesNapGates(leader, gap)) continue;

    const edge = leader.modelEdge ?? 1;
    const confidence: RacingNapPick["confidence"] =
      edge >= NAP_STRONG_EDGE && gap >= 0.07 ? "high" : "medium";

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

  const naps = candidates
    .sort((a, b) => b.edge * b.scoreGap - a.edge * a.scoreGap)
    .slice(0, maxNaps);

  const napIds = new Set(naps.map((n) => n.raceId));
  for (const race of races) {
    if (napIds.has(race.id)) {
      race.topPickConfidence = "nap";
      if (race.topPick) race.topPick.confidence = "nap";
    }
  }

  return naps;
}

/** Race IDs whose #1 cleared the confident (or nap) tier. */
export function confidentRaceIds(races: HorseRace[]): string[] {
  return races
    .filter(
      (r) =>
        r.topPickConfidence === "confident" || r.topPickConfidence === "nap"
    )
    .map((r) => r.id);
}
