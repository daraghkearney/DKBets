/**
 * Prediction model — applies learned factor weights and tipster signals
 * to enriched racecards, producing final scores and predicted ranks.
 */
import { computeOverall, DEFAULT_FACTOR_WEIGHTS } from "./form-analysis";
import type {
  HorseRace,
  RacingFactorKey,
  TipsterPick,
} from "./types";

export function normalizeHorseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match tipster picks to actual runners by horse name (in the pick's
 * `horse` field or anywhere in the rationale). Fixes each matched pick's
 * raceId so the UI shows it under the right meeting, and returns
 * aggregated tipster confidence per runner id.
 */
export function matchTipstersToRunners(
  races: HorseRace[],
  tipsters: TipsterPick[]
): Map<string, number> {
  const runnerIndex: Array<{
    runnerId: string;
    raceId: string;
    normalized: string;
  }> = [];
  for (const race of races) {
    for (const r of race.runners) {
      const normalized = normalizeHorseName(r.name);
      if (normalized.length >= 4) {
        runnerIndex.push({ runnerId: r.id, raceId: race.id, normalized });
      }
    }
  }

  const confidence = new Map<string, number>();

  for (const pick of tipsters) {
    const pickHorse = normalizeHorseName(pick.horse);
    const rationale = normalizeHorseName(pick.rationale);

    let matched: { runnerId: string; raceId: string } | null = null;
    if (pickHorse.length >= 4) {
      for (const entry of runnerIndex) {
        if (
          pickHorse === entry.normalized ||
          pickHorse.includes(entry.normalized) ||
          entry.normalized.includes(pickHorse)
        ) {
          matched = entry;
          break;
        }
      }
    }
    if (!matched) {
      for (const entry of runnerIndex) {
        if (rationale.includes(entry.normalized)) {
          matched = entry;
          break;
        }
      }
    }
    if (!matched) continue;

    pick.raceId = matched.raceId;
    const prev = confidence.get(matched.runnerId) ?? 0;
    // Multiple independent tips stack with diminishing returns
    confidence.set(
      matched.runnerId,
      prev + pick.confidence * (1 - prev * 0.6)
    );
  }

  return confidence;
}

/**
 * Apply the current model to enriched races: tipster boosts, learned
 * weights, final overall score, predicted rank and readable notes.
 */
export function applyModel(
  races: HorseRace[],
  tipsters: TipsterPick[],
  weights: Record<RacingFactorKey, number> = DEFAULT_FACTOR_WEIGHTS
): void {
  const tipsterConfidence = matchTipstersToRunners(races, tipsters);

  for (const race of races) {
    for (const runner of race.runners) {
      const tip = tipsterConfidence.get(runner.id);
      if (tip != null) {
        runner.tipsterScore = Math.min(0.95, 0.5 + tip * 0.45);
        runner.notes = [
          `Backed by ${tip > 0.9 ? "multiple tipsters" : "tipster intel"} (${Math.round(runner.tipsterScore * 100)}% signal)`,
          ...runner.notes,
        ];
      } else {
        runner.tipsterScore = 0.5;
      }
      runner.overallScore = computeOverall(runner, weights);
    }

    const ranked = [...race.runners].sort(
      (a, b) => b.overallScore - a.overallScore
    );
    ranked.forEach((r, i) => {
      r.predictedRank = i + 1;
    });
  }
}
