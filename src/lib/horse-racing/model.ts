/**
 * Prediction model — applies learned factor weights, trainer/jockey
 * strike rates, field-relative ratings, draw/topspeed and tipster signals.
 */
import { scoreDraw } from "./draw-bias";
import {
  applyRatingScores,
  applyTopspeedScores,
  computeOverall,
  DEFAULT_FACTOR_WEIGHTS,
  strikePctScore,
} from "./form-analysis";
import { calibrateRaceProbabilities, topRunner } from "./probability";
import { segmentRace, weightsForSegment } from "./race-type";
import { strikeRateScore, type PeopleStats } from "./people-stats";
import type {
  HorseRace,
  HorseRunner,
  RacingCalendarDay,
  RacingFactorKey,
  TipsterPick,
} from "./types";
import { tipsterSignalWeight } from "./tipster-priority";

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

    const candidates = pick.raceId
      ? runnerIndex.filter((e) => e.raceId === pick.raceId)
      : runnerIndex;
    if (pick.raceId && !candidates.length) continue;

    let matched: (typeof runnerIndex)[number] | null = null;
    if (pickHorse.length >= 4) {
      for (const entry of candidates) {
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
      for (const entry of candidates) {
        if (rationale.includes(entry.normalized)) {
          matched = entry;
          break;
        }
      }
    }
    if (!matched) continue;

    pick.raceId = matched.raceId;
    pick.matchedRunner = matched.name;
    const weight = tipsterSignalWeight(pick);
    const prev = signals.get(matched.runnerId) ?? {
      confidence: 0,
      hot: false,
    };
    signals.set(matched.runnerId, {
      confidence:
        prev.confidence +
        pick.confidence * weight * (1 - prev.confidence * 0.6),
      hot:
        prev.hot ||
        (pick.hot === true &&
          (pick.platform !== "press" || weight >= 1)),
    });
  }

  return signals;
}

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
 * draw/topspeed, tipster boosts, segment weights, final score and rank.
 */
export function applyModel(
  races: HorseRace[],
  tipsters: TipsterPick[],
  weights: Record<RacingFactorKey, number> = DEFAULT_FACTOR_WEIGHTS,
  peopleStats?: PeopleStats
): void {
  const tipsterSignals = matchTipstersToRunners(races, tipsters);

  for (const race of races) {
    const raceWeights = weightsForSegment(weights, segmentRace(race));
    applyRatingScores(race.runners);
    applyTopspeedScores(race.runners);

    for (const runner of race.runners) {
      if (runner.trainerStrikePct != null) {
        runner.trainerScore = strikePctScore(runner.trainerStrikePct);
        if (runner.trainerStrikePct >= 20) {
          runner.notes.push(
            `Trainer ${runner.trainerStrikePct}% recent strike rate`
          );
        }
      } else if (peopleStats) {
        const trainer = strikeRateScore(peopleStats.trainers, runner.trainer);
        runner.trainerScore = trainer.score;
        if (trainer.note) runner.notes.push(`Trainer ${trainer.note}`);
      }

      const combo = jockeyComboBoost(runner);
      let jockeyBase = 0.5;
      if (runner.jockeyStrikePct != null) {
        jockeyBase = strikePctScore(runner.jockeyStrikePct);
        if (runner.jockeyStrikePct >= 20) {
          runner.notes.push(
            `Jockey ${runner.jockeyStrikePct}% recent strike rate`
          );
        }
      } else if (peopleStats) {
        const jockey = strikeRateScore(peopleStats.jockeys, runner.jockey);
        jockeyBase = jockey.score;
        if (jockey.note) runner.notes.push(`Jockey ${jockey.note}`);
      }
      runner.jockeyScore = Math.min(0.95, jockeyBase + combo.boost);
      if (combo.note) runner.notes.push(combo.note);

      const draw = scoreDraw(
        race.course,
        race.distanceYards,
        runner.draw,
        race.runners.length,
        race.going
      );
      runner.drawScore = draw.score;
      if (draw.notes.length) runner.notes.push(...draw.notes);

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

      runner.overallScore = computeOverall(runner, raceWeights);
    }

    const ranked = [...race.runners].sort(
      (a, b) => b.overallScore - a.overallScore
    );
    ranked.forEach((r, i) => {
      r.predictedRank = i + 1;
    });

    calibrateRaceProbabilities(race);
    const leader = topRunner(race);
    if (leader?.winProbability != null) {
      race.topPick = {
        runnerId: leader.id,
        name: leader.name,
        odds: leader.odds,
        modelProb: leader.winProbability,
        edge: leader.modelEdge ?? 1,
      };
    }
  }
}

/** Promote strong post-model signals to red-hot tips for the racecard UI. */
export function augmentSignalHotTips(
  days: RacingCalendarDay[],
  tipsters: TipsterPick[]
): void {
  const existing = new Set(
    tipsters
      .filter((t) => t.hot)
      .map((t) => `${t.raceId}|${normalizeHorseName(t.matchedRunner ?? t.horse)}`)
  );

  for (const day of days) {
    for (const meeting of day.meetings) {
      for (const race of meeting.races) {
        for (const runner of race.runners) {
          if (runner.tipsterScore < 0.8) continue;
          const key = `${race.id}|${normalizeHorseName(runner.name)}`;
          if (existing.has(key)) continue;

          tipsters.push({
            id: `signal-${race.id}-${runner.id}`,
            tipster: "Strong multi-source signal",
            horse: runner.name,
            raceId: race.id,
            confidence: runner.tipsterScore,
            trackRecord: `Tipster intel ${Math.round(runner.tipsterScore * 100)}%`,
            rationale:
              runner.notes.find((n) => /tipster|verdict|🔥/i.test(n)) ??
              runner.spotlight ??
              `Model rates ${runner.name} highly with insider backing`,
            hot: true,
            platform: "web",
            matchedRunner: runner.name,
          });
          existing.add(key);
        }
      }
    }
  }
}
