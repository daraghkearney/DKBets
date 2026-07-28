/**
 * "Top finish" meeting multi — per meeting, pick 2–4 horses across
 * different races, each to finish inside a position band (top 4 / top 5 /
 * top 10 …). Each leg is chosen where the model's finish probability is
 * extremely high AND the market (derived from win odds) underprices it,
 * so the combined slip carries big odds at high combined probability.
 *
 * Finish probabilities come from a seeded Plackett–Luce Monte Carlo over
 * the race's calibrated win probabilities (model side) and normalised
 * odds-implied probabilities (market side), blended with each runner's
 * recent-form finish rate.
 */
import { toFractional } from "@/lib/format";
import type { HorseRace, HorseRunner, TopFinishLeg, TopFinishSlip } from "./types";

/** Candidate "top N" bands; filtered per field size. */
const TARGET_OPTIONS = [2, 3, 4, 5, 6, 8, 10];
/**
 * Legs must be clearly likely per the model. MC + form blending is
 * conservative, so 0.6+ here corresponds to a strong "should make the
 * frame" view; the per-horse band choice below then maximises probability.
 */
const MIN_MODEL_PROB = 0.6;
/** Model prob − est. bookmaker implied must clear this. */
const MIN_EDGE = 0.04;
/** Legs must still pay — combining 1.05s is pointless. */
const MIN_LEG_PRICE = 1.28;
/** Typical bookmaker margin on extra-place / top-N markets. */
const BOOKIE_MARGIN = 1.14;
/** Need most of the field priced for a trustworthy market estimate. */
const MIN_ODDS_COVERAGE = 0.6;
const MIN_FIELD = 6;
const MC_ITERS = 800;
const MIN_LEGS = 2;
const MAX_LEGS = 4;
/** Slip must be worth backing — combined estimated decimal. */
const MIN_COMBINED_PRICE = 1.7;

// ------------------------------------------------------------ seeded RNG

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------ Monte Carlo core

/**
 * P(finish position ≤ n) per runner for n = 1..maxN, via Plackett–Luce
 * sampling without replacement from `probs` (need not be normalised).
 */
function simulateTopN(
  probs: number[],
  maxN: number,
  rng: () => number,
  iters = MC_ITERS
): number[][] {
  const n = probs.length;
  const draws = Math.min(maxN, n);
  const counts: number[][] = Array.from({ length: n }, () =>
    new Array(draws).fill(0)
  );

  const idx = new Array<number>(n);
  const p = new Array<number>(n);

  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      idx[i] = i;
      p[i] = probs[i]!;
    }
    let remaining = n;
    let total = 0;
    for (let i = 0; i < n; i++) total += p[i]!;

    for (let pos = 0; pos < draws; pos++) {
      if (total <= 0 || remaining === 0) break;
      let u = rng() * total;
      let chosen = remaining - 1;
      for (let i = 0; i < remaining; i++) {
        u -= p[i]!;
        if (u <= 0) {
          chosen = i;
          break;
        }
      }
      const runner = idx[chosen]!;
      counts[runner]![pos]! += 1;
      total -= p[chosen]!;
      // swap-remove
      idx[chosen] = idx[remaining - 1]!;
      p[chosen] = p[remaining - 1]!;
      remaining -= 1;
    }
  }

  // Cumulative P(≤ n)
  return counts.map((row) => {
    const cum: number[] = new Array(draws).fill(0);
    let acc = 0;
    for (let i = 0; i < draws; i++) {
      acc += row[i]!;
      cum[i] = acc / iters;
    }
    return cum;
  });
}

/** Recent-form rate of finishing ≤ n (null when too little form). */
function formTopNRate(runner: HorseRunner, n: number): number | null {
  const recent = runner.formRuns
    .slice(0, 5)
    .filter((r) => r.position > 0 && r.runners > 0);
  if (recent.length < 2) return null;
  const hits = recent.filter((r) => r.position <= n).length;
  return hits / recent.length;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function targetsForField(fieldSize: number): number[] {
  return TARGET_OPTIONS.filter((n) => {
    if (n > Math.floor(fieldSize * 0.55)) return false;
    if (n >= 8 && fieldSize < 13) return false;
    if (n >= 10 && fieldSize < 16) return false;
    return true;
  });
}

interface LegCandidate {
  leg: TopFinishLeg;
  score: number;
}

/**
 * Every runner × target combination for a race, ungated — used for both
 * selection (gated below) and threshold tuning in tests.
 */
export function topFinishCandidatesForRace(race: HorseRace): LegCandidate[] {
  const runners = race.runners.filter(
    (r) => r.name.length >= 2 && (r.winProbability ?? 0) > 0
  );
  const fieldSize = runners.length;
  if (fieldSize < MIN_FIELD) return [];

  const priced = runners.filter(
    (r) => r.odds != null && r.odds > 1 && r.odds <= 501
  );
  if (priced.length / fieldSize < MIN_ODDS_COVERAGE) return [];

  const targets = targetsForField(fieldSize);
  if (!targets.length) return [];
  const maxN = targets[targets.length - 1]!;

  // Model side: calibrated win probabilities
  const modelProbs = runners.map((r) => Math.max(0.001, r.winProbability ?? 0));

  // Market side: odds-implied, unpriced runners get the field's floor
  const implieds = priced.map((r) => 1 / r.odds!);
  const floor = Math.min(...implieds) * 0.8;
  const marketProbs = runners.map((r) =>
    r.odds != null && r.odds > 1 && r.odds <= 501 ? 1 / r.odds : floor
  );

  const seed = hashString(`${race.id}|top-finish`);
  const modelTop = simulateTopN(modelProbs, maxN, mulberry32(seed));
  const marketTop = simulateTopN(marketProbs, maxN, mulberry32(seed ^ 0x9e3779b9));

  const out: LegCandidate[] = [];

  for (let i = 0; i < runners.length; i++) {
    const runner = runners[i]!;
    if (runner.odds == null || runner.odds <= 1 || runner.odds > 501) continue;

    for (const target of targets) {
      const nIdx = target - 1;
      if (nIdx >= (modelTop[i]?.length ?? 0)) continue;

      const mc = modelTop[i]![nIdx]!;
      const form = formTopNRate(runner, target);
      const modelProb = clamp(
        form != null ? mc * 0.7 + form * 0.3 : mc,
        0.02,
        0.97
      );

      const marketProb = clamp(marketTop[i]![nIdx]!, 0.02, 0.97);
      const bookieImplied = Math.min(0.955, marketProb * BOOKIE_MARGIN);
      const estPrice = Math.max(1.04, 1 / bookieImplied);
      const edge = modelProb - bookieImplied;
      const score = edge * (estPrice - 1) * modelProb;

      const edgePts = Math.round(edge * 100);
      out.push({
        score,
        leg: {
          raceId: race.id,
          time: race.time,
          raceName: race.name,
          course: race.course,
          runnerId: runner.id,
          horse: runner.name,
          winOdds: runner.odds,
          target,
          fieldSize,
          modelProb: Math.round(modelProb * 1000) / 1000,
          marketProb: Math.round(marketProb * 1000) / 1000,
          estPrice: Math.round(estPrice * 100) / 100,
          edge: Math.round(edge * 1000) / 1000,
          rationale:
            `Model ${Math.round(modelProb * 100)}% to finish top ${target} of ${fieldSize} — ` +
            `market prices it like ${Math.round(bookieImplied * 100)}% ` +
            `(est. ${toFractional(estPrice)}, +${edgePts} pts)` +
            (form != null && form >= 0.6
              ? ` · ${Math.round(form * 100)}% of recent runs finished top ${target}`
              : ""),
        },
      });
    }
  }

  return out;
}

/**
 * Best gated top-finish leg for one race (or null).
 *
 * Per horse we take the HIGHEST-probability band that still pays
 * (edge + price gates) — e.g. "top 8" at 1.5 beats "top 3" at 3.3 for the
 * same horse, because the slip wants extreme per-leg probability and lets
 * the accumulator build the price. Races then compete on edge × probability.
 */
function bestLegForRace(race: HorseRace): LegCandidate | null {
  const gated = topFinishCandidatesForRace(race).filter(
    (c) =>
      c.leg.modelProb >= MIN_MODEL_PROB &&
      c.leg.estPrice >= MIN_LEG_PRICE &&
      c.leg.edge >= MIN_EDGE
  );
  if (!gated.length) return null;

  // Highest-probability qualifying band per horse
  const byHorse = new Map<string, LegCandidate>();
  for (const c of gated) {
    const cur = byHorse.get(c.leg.runnerId);
    if (
      !cur ||
      c.leg.modelProb > cur.leg.modelProb ||
      (c.leg.modelProb === cur.leg.modelProb &&
        c.leg.estPrice > cur.leg.estPrice)
    ) {
      byHorse.set(c.leg.runnerId, c);
    }
  }

  // Strongest horse in the race by conviction × value
  let best: LegCandidate | null = null;
  for (const c of byHorse.values()) {
    const rank = c.leg.edge * c.leg.modelProb;
    const bestRank = best ? best.leg.edge * best.leg.modelProb : -1;
    if (rank > bestRank) best = c;
  }
  return best;
}

/**
 * Build the meeting's top-finish multi: up to MAX_LEGS legs from different
 * races, all high-probability underpriced finish bands. Null when the
 * meeting can't produce a slip worth backing.
 */
export function buildTopFinishSlip(
  races: HorseRace[],
  date: string,
  course: string
): TopFinishSlip | null {
  const candidates: LegCandidate[] = [];
  for (const race of races) {
    const cand = bestLegForRace(race);
    if (cand) candidates.push(cand);
  }
  if (candidates.length < MIN_LEGS) return null;

  candidates.sort((a, b) => b.score - a.score);

  const legs: TopFinishLeg[] = [];
  const usedHorses = new Set<string>();
  for (const c of candidates) {
    if (legs.length >= MAX_LEGS) break;
    const key = c.leg.horse.toLowerCase();
    if (usedHorses.has(key)) continue;
    usedHorses.add(key);
    legs.push(c.leg);
  }
  if (legs.length < MIN_LEGS) return null;

  legs.sort((a, b) => a.time.localeCompare(b.time));

  const combinedProb = legs.reduce((acc, l) => acc * l.modelProb, 1);
  const combinedPrice = legs.reduce((acc, l) => acc * l.estPrice, 1);
  if (combinedPrice < MIN_COMBINED_PRICE) return null;

  return {
    date,
    course,
    legs,
    combinedProb: Math.round(combinedProb * 1000) / 1000,
    combinedPrice: Math.round(combinedPrice * 100) / 100,
    note:
      `${legs.length} finish-position picks across ${course} — every leg ` +
      `heavily model-backed and underpriced vs win-odds-derived market. ` +
      `Prices are estimates; bookmaker top-finish/extra-place terms vary.`,
  };
}
