import { buildUnderpricedGem } from "./gem";
import { ODDS_TARGETS } from "./odds";
import { slipFromLegs } from "./legs";
import type {
  BuilderComposedView,
  BuilderLeg,
  BuilderSlip,
  OddsTarget,
  UnderpricedGem,
} from "./types";

export type BuilderScope = "single" | "today" | "multi";

export interface BuilderOptions {
  scope: BuilderScope;
  /** Required when scope is "single" */
  matchId?: number;
  maxLegs: number;
}

function legConflict(a: BuilderLeg, b: BuilderLeg): boolean {
  if (a.matchId !== b.matchId) return false;
  if (a.playerName && b.playerName && a.playerName === b.playerName) {
    return a.category === b.category;
  }
  return a.market === b.market;
}

function canAdd(chosen: BuilderLeg[], leg: BuilderLeg): boolean {
  return !chosen.some((c) => legConflict(c, leg));
}

function minSampleForTarget(_target: OddsTarget): number {
  return 2;
}

/** Always rank by model probability — never by price length. */
function sortByProbability(candidates: BuilderLeg[]): BuilderLeg[] {
  return [...candidates].sort(
    (a, b) =>
      b.hitRate - a.hitRate ||
      b.sample - a.sample ||
      a.decimalOdds - b.decimalOdds
  );
}

function combinedDecimal(legs: BuilderLeg[]): number {
  return Math.round(legs.reduce((acc, l) => acc * l.decimalOdds, 1) * 100) / 100;
}

function combinedProbability(legs: BuilderLeg[]): number {
  return legs.reduce((acc, l) => acc * l.hitRate, 1);
}

/** Filter leg pool by Bet Builder scope (Bet365 section only). */
export function filterLegsByScope(
  pool: BuilderLeg[],
  options: BuilderOptions
): BuilderLeg[] {
  if (options.scope === "single" && options.matchId != null) {
    return pool.filter((l) => l.matchId === options.matchId);
  }
  if (options.scope === "today") {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    return pool.filter((leg) => {
      const k = new Date(leg.kickoff);
      return (
        k.getUTCFullYear() === y &&
        k.getUTCMonth() === m &&
        k.getUTCDate() === d
      );
    });
  }
  return pool;
}

/**
 * Find the valid slip with the highest combined model probability
 * whose Bet365 odds land in the target window.
 */
function tryBuildMaxProbability(
  candidates: BuilderLeg[],
  target: OddsTarget,
  maxLegs: number,
  scope: BuilderScope
): BuilderLeg[] | null {
  const sorted = sortByProbability(candidates);
  const cap =
    scope === "multi"
      ? Math.min(36, sorted.length)
      : Math.min(26, sorted.length);
  const pool = sorted.slice(0, cap);
  if (!pool.length) return null;

  const MAX_VISITS = scope === "multi" ? 25_000 : 45_000;
  let visits = 0;
  let best: BuilderLeg[] | null = null;
  let bestProb = 0;
  const chosen: BuilderLeg[] = [];

  function search(start: number, odds: number) {
    if (visits++ > MAX_VISITS) return;

    if (
      chosen.length >= 1 &&
      odds >= target.decimalMin &&
      odds <= target.decimalMax
    ) {
      const prob = combinedProbability(chosen);
      if (prob > bestProb) {
        bestProb = prob;
        best = chosen.slice();
      }
    }

    if (chosen.length >= maxLegs) return;

    for (let i = start; i < pool.length; i++) {
      const leg = pool[i];
      if (!canAdd(chosen, leg)) continue;
      chosen.push(leg);
      search(i + 1, Math.round(odds * leg.decimalOdds * 100) / 100);
      chosen.pop();
    }
  }

  search(0, 1);
  return best;
}

/** Highest hit-rate leg per fixture, then max-probability combo search. */
function tryBuildPerMatchMaxProb(
  candidates: BuilderLeg[],
  target: OddsTarget,
  maxLegs: number
): BuilderLeg[] | null {
  const bestByMatch = new Map<number, BuilderLeg>();
  for (const leg of candidates) {
    const cur = bestByMatch.get(leg.matchId);
    if (
      !cur ||
      leg.hitRate > cur.hitRate ||
      (leg.hitRate === cur.hitRate && leg.sample > cur.sample)
    ) {
      bestByMatch.set(leg.matchId, leg);
    }
  }
  const perMatch = sortByProbability([...bestByMatch.values()]);
  if (perMatch.length < 2) return null;
  return tryBuildMaxProbability(perMatch, target, maxLegs, "multi");
}

function maxAchievableOdds(candidates: BuilderLeg[], maxLegs: number): number {
  const sorted = [...candidates].sort((a, b) => b.decimalOdds - a.decimalOdds);
  const chosen: BuilderLeg[] = [];
  for (const leg of sorted) {
    if (chosen.length >= maxLegs) break;
    if (!canAdd(chosen, leg)) continue;
    chosen.push(leg);
  }
  return chosen.length ? combinedDecimal(chosen) : 1;
}

/** Build slip with highest combined probability inside the odds band. */
export function buildForTarget(
  pool: BuilderLeg[],
  target: OddsTarget,
  maxLegs: number,
  scope: BuilderScope = "multi"
): BuilderSlip | null {
  const filtered = pool.filter(
    (l) => l.sample >= minSampleForTarget(target) && l.hitRate >= 0.52
  );
  const candidates = sortByProbability(filtered);
  if (!candidates.length) return null;

  const ceiling = maxAchievableOdds(candidates, maxLegs);
  if (ceiling < target.decimalMin) return null;

  const chosen =
    (scope === "multi"
      ? tryBuildPerMatchMaxProb(candidates, target, maxLegs)
      : null) ??
    tryBuildMaxProbability(candidates, target, maxLegs, scope);

  if (!chosen?.length) return null;

  return slipFromLegs(
    `builder-${target.id}`,
    `Bet365 Builder — ${target.label}`,
    chosen,
    target.label
  );
}

/** Highest-confidence slip for today (single or cross-match). */
export function buildTodaysPick(
  pool: BuilderLeg[],
  maxLegs: number
): BuilderSlip | null {
  const candidates = sortByProbability(
    pool.filter((l) => l.sample >= 2 && l.hitRate >= 0.75)
  ).slice(0, pool.length > 40 ? 24 : pool.length);

  if (!candidates.length) return null;

  const single = candidates.find((l) => l.hitRate >= 0.85 && l.sample >= 3);
  if (single) {
    return slipFromLegs("todays-pick", "Today's Pick — Banker", [single]);
  }

  if (maxLegs >= 2) {
    let bestPair: BuilderLeg[] | null = null;
    let bestPairProb = 0;
    for (let i = 0; i < Math.min(candidates.length, 30); i++) {
      for (let j = i + 1; j < Math.min(candidates.length, 35); j++) {
        const a = candidates[i];
        const b = candidates[j];
        if (!canAdd([a], b)) continue;
        const prob = a.hitRate * b.hitRate;
        if (prob >= 0.78 && prob > bestPairProb) {
          bestPairProb = prob;
          bestPair = [a, b];
        }
      }
    }
    if (bestPair) {
      return slipFromLegs("todays-pick", "Today's Pick — Double", bestPair);
    }
  }

  if (maxLegs >= 3) {
    let bestTriple: BuilderLeg[] | null = null;
    let bestTripleProb = 0;
    const n = Math.min(candidates.length, 12);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const legs = [candidates[i], candidates[j], candidates[k]];
          if (!canAdd([legs[0]], legs[1]) || !canAdd([legs[0], legs[1]], legs[2]))
            continue;
          const prob = legs.reduce((acc, l) => acc * l.hitRate, 1);
          if (prob >= 0.72 && prob > bestTripleProb) {
            bestTripleProb = prob;
            bestTriple = legs;
          }
        }
      }
    }
    if (bestTriple) {
      return slipFromLegs("todays-pick", "Today's Pick — Treble", bestTriple);
    }
  }

  return slipFromLegs("todays-pick", "Today's Pick — Best available", [
    candidates[0],
  ]);
}

export function buildAllTargets(
  pool: BuilderLeg[],
  maxLegs: number,
  scope: BuilderScope = "multi"
): Record<string, BuilderSlip | null> {
  const out: Record<string, BuilderSlip | null> = {};
  for (const target of ODDS_TARGETS) {
    out[target.id] = buildForTarget(pool, target, maxLegs, scope);
  }
  return out;
}

export function maxOddsInScope(pool: BuilderLeg[], maxLegs: number): number {
  return maxAchievableOdds(pool, maxLegs);
}

/** Compose full builder view client-side from exported leg pool. */
export function composeBuilderView(
  pool: BuilderLeg[],
  options: BuilderOptions
): BuilderComposedView {
  const scoped = filterLegsByScope(pool, options);
  const todaysPick = buildTodaysPick(scoped, options.maxLegs);
  const excludeIds = todaysPick?.legs.map((l) => l.id) ?? [];
  return {
    todaysPick,
    underpricedGem: buildUnderpricedGem(scoped, excludeIds),
    builders: buildAllTargets(scoped, options.maxLegs, options.scope),
  };
}

/** Pre-compose common scope/max-legs combos at export time. */
export function precomputeBuilderViews(
  pool: BuilderLeg[],
  fixtures: Array<{ id: number }>,
  maxLegsValues: number[] = [8]
): import("./types").BuilderPrecomputed {
  const byMaxLegs: import("./types").BuilderPrecomputed["byMaxLegs"] = {};

  for (const maxLegs of maxLegsValues) {
    const key = String(maxLegs);
    const single: Record<string, BuilderComposedView> = {};
    for (const fx of fixtures) {
      single[String(fx.id)] = composeBuilderView(pool, {
        scope: "single",
        matchId: fx.id,
        maxLegs,
      });
    }
    byMaxLegs[key] = {
      today: composeBuilderView(pool, { scope: "today", maxLegs }),
      multi: composeBuilderView(pool, { scope: "multi", maxLegs }),
      single,
    };
  }

  return { byMaxLegs };
}

export function lookupPrecomputedView(
  precomputed: import("./types").BuilderPrecomputed | undefined,
  options: BuilderOptions
): BuilderComposedView | null {
  if (!precomputed) return null;
  const bucket = precomputed.byMaxLegs[String(options.maxLegs)];
  if (!bucket) return null;
  if (options.scope === "single" && options.matchId != null) {
    return bucket.single[String(options.matchId)] ?? null;
  }
  if (options.scope === "today") return bucket.today;
  return bucket.multi;
}

export type { BuilderComposedView, UnderpricedGem } from "./types";
export { ODDS_TARGETS };
