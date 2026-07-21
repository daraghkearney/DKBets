import { toFractional } from "@/lib/format";
import type { EachWayGem, HorseRace, HorseRunner } from "./types";

/** Minimum decimal odds (~5/1) — shorter prices rarely pay for EW at 1/5 terms. */
export const EW_MIN_ODDS = 6.0;
/** Beyond this, place models are too noisy for a selective gem. */
export const EW_MAX_ODDS = 26.0;
/** Prefer fields with at least 3 standard places. */
export const EW_MIN_FIELD = 8;
/** Football-style place edge floor (placeProb − placeImplied). */
export const EW_MIN_PLACE_EDGE = 0.05;
/** Cap how many EW gems we publish per race day. */
export const EW_MAX_DAILY_GEMS = 3;
/** Standard UK each-way place fraction (place part of a win bet). */
export const EW_PLACE_FRACTION = 1 / 5;

/** UK each-way place count by field size (non-handicap default). */
export function ewPlacePositions(fieldSize: number): number {
  if (fieldSize < 5) return 0;
  if (fieldSize <= 7) return 2;
  if (fieldSize <= 15) return 3;
  return 4;
}

/** Place decimal at 1/5 terms: 1 + (winOdds − 1) / 5. */
export function placeDecimalFromWinOdds(
  winOdds: number,
  fraction = EW_PLACE_FRACTION
): number {
  return 1 + (winOdds - 1) * fraction;
}

export function placeImpliedFromWinOdds(winOdds: number): number {
  const placeDec = placeDecimalFromWinOdds(winOdds);
  return placeDec > 1 ? 1 / placeDec : 1;
}

/**
 * Harville approximation for P(finish in top `places`).
 * Uses race win probabilities when available.
 */
export function estimatePlaceProbability(
  runners: HorseRunner[],
  target: HorseRunner,
  places: number
): number {
  if (places <= 0) return 0;
  const indexed = runners
    .map((r, i) => ({ r, i, p: Math.max(0.001, r.winProbability ?? 0) }))
    .filter((x) => x.r.name.length >= 2);
  const sum = indexed.reduce((a, x) => a + x.p, 0);
  if (!sum) return empiricFormPlaceRate(target, places);

  const probs = indexed.map((x) => x.p / sum);
  const idx = indexed.findIndex((x) => x.r.id === target.id);
  if (idx < 0) return empiricFormPlaceRate(target, places);

  // P(win)
  let placeProb = probs[idx]!;

  // P(2nd) via Harville
  if (places >= 2) {
    for (let j = 0; j < probs.length; j++) {
      if (j === idx) continue;
      const denom = 1 - probs[j]!;
      if (denom <= 0.01) continue;
      placeProb += probs[j]! * (probs[idx]! / denom);
    }
  }

  // P(3rd) approximation: average conditional over top win pairs
  if (places >= 3 && probs.length >= 3) {
    let third = 0;
    for (let j = 0; j < probs.length; j++) {
      if (j === idx) continue;
      for (let k = 0; k < probs.length; k++) {
        if (k === idx || k === j) continue;
        const d1 = 1 - probs[j]!;
        if (d1 <= 0.01) continue;
        const p2 = probs[k]! / d1;
        const d2 = 1 - probs[j]! - probs[k]!;
        if (d2 <= 0.01) continue;
        third += probs[j]! * p2 * (probs[idx]! / d2);
      }
    }
    // Pair loops overcount; dampen
    placeProb += third / Math.max(1, probs.length - 2);
  }

  const formRate = empiricFormPlaceRate(target, places);
  // Blend model place estimate with recent form place rate
  const blended = placeProb * 0.55 + formRate * 0.45;
  return Math.max(0.05, Math.min(0.9, blended));
}

function empiricFormPlaceRate(runner: HorseRunner, places: number): number {
  const recent = runner.formRuns.slice(0, 5);
  if (!recent.length) {
    // Soft prior from scores when no form digits
    const prior =
      runner.recentFormScore * 0.45 +
      runner.courseFitScore * 0.2 +
      runner.distanceFitScore * 0.2 +
      runner.goingFitScore * 0.15;
    return Math.max(0.12, Math.min(0.55, prior * 0.7));
  }
  const hits = recent.filter((r) => r.position > 0 && r.position <= places)
    .length;
  return hits / recent.length;
}

function placeProfileBoost(runner: HorseRunner): number {
  let s = 0;
  if (runner.recentFormScore >= 0.65) s += 0.015;
  if (runner.courseFitScore >= 0.68) s += 0.01;
  if (runner.distanceFitScore >= 0.68) s += 0.01;
  if (runner.courseWinner) s += 0.012;
  if (runner.distanceWinner) s += 0.01;
  if ((runner.rpr ?? 0) >= 100) s += 0.008;
  if ((runner.tipCount ?? 0) > 0) s += 0.006;
  if (runner.tipsterScore >= 0.65) s += 0.008;
  return s;
}

export interface EachWayCandidate {
  race: HorseRace;
  runner: HorseRunner;
  odds: number;
  placeProb: number;
  placeImplied: number;
  placeEdge: number;
  gemScore: number;
}

/** Score one race for a football-style EW gem (odds + place edge required). */
export function scoreEachWayCandidates(race: HorseRace): EachWayCandidate[] {
  const runners = race.runners.filter((r) => r.name.length >= 2);
  if (runners.length < EW_MIN_FIELD) return [];

  const places = ewPlacePositions(runners.length);
  if (places < 2) return [];

  const top = [...runners].sort((a, b) => b.overallScore - a.overallScore)[0];
  if (!top) return [];

  const out: EachWayCandidate[] = [];

  for (const r of runners) {
    if (r.odds == null || !Number.isFinite(r.odds)) continue;
    if (r.odds < EW_MIN_ODDS || r.odds > EW_MAX_ODDS) continue;

    // Favourites at short prices are win bets, not EW value
    if (r.predictedRank === 1 && r.odds < 10) continue;

    // Must be competitive with the model leader (not a random outsider)
    if (r.overallScore < top.overallScore * 0.72) continue;

    const placeProb = estimatePlaceProbability(runners, r, places);
    const placeImplied = placeImpliedFromWinOdds(r.odds);
    const placeEdge = placeProb - placeImplied;
    if (placeEdge < EW_MIN_PLACE_EDGE) continue;

    let gemScore = placeEdge;
    gemScore += placeProfileBoost(r);
    // Prefer true EW band (~6–16) where place terms pay
    if (r.odds >= 8 && r.odds <= 16) gemScore += 0.015;
    if (r.odds >= 6 && r.odds < 8) gemScore += 0.005;
    if (runners.length >= 12 && places >= 3) gemScore += 0.01;

    out.push({
      race,
      runner: r,
      odds: r.odds,
      placeProb,
      placeImplied,
      placeEdge,
      gemScore,
    });
  }

  return out.sort((a, b) => b.gemScore - a.gemScore);
}

function buildGem(c: EachWayCandidate): EachWayGem {
  const edgePts = Math.round(c.placeEdge * 100);
  const frac = toFractional(c.odds);
  const parts: string[] = [
    `${frac} (${c.odds.toFixed(1)}) implies ~${Math.round(c.placeImplied * 100)}% place at 1/5 terms — model sees ~${Math.round(c.placeProb * 100)}% (${edgePts} pts edge)`,
  ];
  if (c.runner.recentFormScore >= 0.6) parts.push("Solid recent place profile");
  if (c.runner.courseWinner) parts.push("Course winner");
  if (c.runner.distanceWinner) parts.push("Distance winner");
  if ((c.runner.rpr ?? 0) >= 100) parts.push(`RPR ${c.runner.rpr}`);

  return {
    runnerId: c.runner.id,
    name: c.runner.name,
    odds: c.odds,
    rationale: parts.join(" · "),
    placeEdge: Math.round(c.placeEdge * 1000) / 1000,
    placeProb: Math.round(c.placeProb * 1000) / 1000,
    placeImplied: Math.round(c.placeImplied * 1000) / 1000,
  };
}

/** Best each-way value runner in a single race — null unless strict gates pass. */
export function pickEachWayGem(race: HorseRace): EachWayGem | null {
  const best = scoreEachWayCandidates(race)[0];
  return best ? buildGem(best) : null;
}

/**
 * Select the best EW gems across a race day (selective, like football underpriced gem).
 * Clears weaker per-race noise — at most EW_MAX_DAILY_GEMS.
 */
export function selectDailyEachWayGems(
  races: HorseRace[],
  maxGems = EW_MAX_DAILY_GEMS
): void {
  for (const race of races) {
    race.eachWayGem = undefined;
  }

  const pool: EachWayCandidate[] = [];
  for (const race of races) {
    const top = scoreEachWayCandidates(race)[0];
    if (top) pool.push(top);
  }

  pool.sort((a, b) => b.gemScore - a.gemScore);

  const usedRunners = new Set<string>();
  let taken = 0;
  for (const c of pool) {
    if (taken >= maxGems) break;
    const key = c.runner.name.toLowerCase();
    if (usedRunners.has(key)) continue;
    usedRunners.add(key);
    c.race.eachWayGem = buildGem(c);
    taken += 1;
  }
}
