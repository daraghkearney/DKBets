/**
 * Prediction model — applies learned factor weights, trainer/jockey
 * strike rates, field-relative ratings and tipster signals to enriched
 * racecards, producing final scores and predicted ranks.
 */
import {
  applyRatingScores,
  computeOverall,
  DEFAULT_FACTOR_WEIGHTS,
} from "./form-analysis";
import { strikeRateScore, type PeopleStats } from "./people-stats";
import type {
  HorseRace,
  HorseRunner,
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
 * raceId so the UI shows it under the right meeting, records the match
 * on the pick, and returns aggregated tipster signal per runner id.
 */
export function matchTipstersToRunners(
  races: HorseRace[],
  tipsters: TipsterPick[]
): Map<string, { confidence: number; hot: boolean }> {
  const runnerIndex: Array<{
    runnerId: string;
    raceId: string;
    name: string;
    normalized: string;
  }> = [];
  for (const race of races) {
    for (const r of race.runners) {
      const normalized = normalizeHorseName(r.name);
      if (normalized.length >= 4) {
        runnerIndex.push({
          runnerId: r.id,
          raceId: race.id,
          name: r.name,
          normalized,
        });
      }
    }
  }

  const signals = new Map<string, { confidence: number; hot: boolean }>();

  for (const pick of tipsters) {
    const pickHorse = normalizeHorseName(pick.horse);
    const rationale = normalizeHorseName(pick.rationale);

    let matched: (typeof runnerIndex)[number] | null = null;
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
    pick.matchedRunner = matched.name;
    const prev = signals.get(matched.runnerId) ?? {
      confidence: 0,
      hot: false,
    };
    signals.set(matched.runnerId, {
      // Multiple independent tips stack with diminishing returns
      confidence: prev.confidence + pick.confidence * (1 - prev.confidence * 0.6),
      hot: prev.hot || pick.hot === true,
    });
  }

  return signals;
}

/** Horse-jockey partnership record from the horse's own form history. */
function jockeyComboBoost(runner: HorseRunner): {
  boost: number;
  note?: string;
} {
  const jockey = normalizeHorseName(runner.jockey);
  if (jockey.length < 4) return { boost: 0 };
  const rides = runner.formRuns.filter(
    (r) => normalizeHorseName(r.jockey) === jockey
  );
  if (rides.length < 2) return { boost: 0 };
  const wins = rides.filter((r) => r.position === 1).length;
  const places = rides.filter((r) => r.position <= 3).length;
  const rate = (wins * 1.5 + places) / (rides.length * 2.5);
  const boost = Math.min(0.15, rate * 0.2);
  const note =
    wins >= 1
      ? `Jockey ${wins}W ${places}P from ${rides.length} rides on this horse`
      : undefined;
  return { boost, note };
}

/**
 * Apply the current model to enriched races: strike rates, ratings,
 * tipster boosts, learned weights, final score and predicted rank.
 */
export function applyModel(
  races: HorseRace[],
  tipsters: TipsterPick[],
  weights: Record<RacingFactorKey, number> = DEFAULT_FACTOR_WEIGHTS,
  peopleStats?: PeopleStats
): void {
  const tipsterSignals = matchTipstersToRunners(races, tipsters);

  for (const race of races) {
    applyRatingScores(race.runners);

    for (const runner of race.runners) {
      // Trainer & jockey strike rates from our results archive
      if (peopleStats) {
        const trainer = strikeRateScore(peopleStats.trainers, runner.trainer);
        runner.trainerScore = trainer.score;
        if (trainer.note) runner.notes.push(`Trainer ${trainer.note}`);

        const jockey = strikeRateScore(peopleStats.jockeys, runner.jockey);
        const combo = jockeyComboBoost(runner);
        runner.jockeyScore = Math.min(0.95, jockey.score + combo.boost);
        if (jockey.note) runner.notes.push(`Jockey ${jockey.note}`);
        if (combo.note) runner.notes.push(combo.note);
      } else {
        const combo = jockeyComboBoost(runner);
        runner.jockeyScore = Math.min(0.95, 0.5 + combo.boost);
        if (combo.note) runner.notes.push(combo.note);
      }

      // Tipster signal
      const tip = tipsterSignals.get(runner.id);
      if (tip) {
        runner.tipsterScore = Math.min(0.95, 0.55 + tip.confidence * 0.35);
        if (tip.hot) {
          runner.tipsterScore = Math.max(runner.tipsterScore, 0.92);
          runner.notes = [
            "🔥 Red-hot tip from high strike-rate tipster",
            ...runner.notes,
          ];
        } else {
          runner.notes = [
            `Backed by tipster intel (${Math.round(runner.tipsterScore * 100)}% signal)`,
            ...runner.notes,
          ];
        }
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
