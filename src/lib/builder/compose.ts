import { ODDS_TARGETS } from "./odds";
import { slipFromLegs } from "./legs";
import type { BuilderComposedView, BuilderLeg, BuilderSlip, OddsTarget } from "./types";

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

function minRateForTarget(target: OddsTarget, poolSize: number): number {
  let min: number;
  if (target.decimalMax <= 2.5) min = 0.78;
  else if (target.decimalMax <= 4) min = 0.65;
  else if (target.decimalMax <= 7) min = 0.62;
  else if (target.decimalMax <= 13) min = 0.58;
  else if (target.decimalMax <= 24) min = 0.55;
  else min = 0.52;

  if (poolSize <= 20) min = Math.max(0.58, min - 0.04);
  return min;
}

function minSampleForTarget(target: OddsTarget): number {
  return target.decimalMax <= 13 ? 2 : 2;
}

function sortForTarget(candidates: BuilderLeg[], target: OddsTarget): BuilderLeg[] {
  if (target.decimalMax <= 7) {
    return [...candidates].sort(
      (a, b) => b.hitRate - a.hitRate || b.sample - a.sample
    );
  }
  return [...candidates].sort(
    (a, b) =>
      b.decimalOdds - a.decimalOdds ||
      b.hitRate - a.hitRate ||
      b.sample - a.sample
  );
}

function combinedDecimal(legs: BuilderLeg[]): number {
  return Math.round(legs.reduce((acc, l) => acc * l.decimalOdds, 1) * 100) / 100;
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

function tryBuildGreedy(
  candidates: BuilderLeg[],
  target: OddsTarget,
  maxLegs: number
): BuilderLeg[] | null {
  const chosen: BuilderLeg[] = [];
  let odds = 1;

  for (const leg of candidates) {
    if (chosen.length >= maxLegs) break;
    if (!canAdd(chosen, leg)) continue;
    chosen.push(leg);
    odds = Math.round(odds * leg.decimalOdds * 100) / 100;
    if (odds >= target.decimalMin && odds <= target.decimalMax) return chosen;
    if (odds > target.decimalMax * 1.15) {
      chosen.pop();
      odds = Math.round((odds / leg.decimalOdds) * 100) / 100;
    }
  }

  if (!chosen.length) return null;
  if (combinedDecimal(chosen) >= target.decimalMin * 0.78) return chosen;
  return null;
}

/** Small combo search for tight single-match pools only. */
function tryBuildCombo(
  candidates: BuilderLeg[],
  target: OddsTarget,
  maxLegs: number
): BuilderLeg[] | null {
  if (candidates.length > 28) return null;

  const pool = candidates.slice(0, Math.min(22, candidates.length));
  const MAX_VISITS = 40_000;
  let visits = 0;
  let best: BuilderLeg[] | null = null;
  let bestDist = Infinity;
  const chosen: BuilderLeg[] = [];

  function search(start: number, odds: number) {
    if (visits++ > MAX_VISITS) return;
    if (chosen.length >= 2 && odds >= target.decimalMin && odds <= target.decimalMax) {
      const dist = Math.abs(odds - (target.decimalMin + target.decimalMax) / 2);
      if (dist < bestDist) {
        bestDist = dist;
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

/** One strong leg per fixture, then greedy — fast for multi-game scopes. */
function tryBuildPerMatch(
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
      (leg.hitRate === cur.hitRate && leg.decimalOdds > cur.decimalOdds)
    ) {
      bestByMatch.set(leg.matchId, leg);
    }
  }
  const perMatch = [...bestByMatch.values()];
  if (perMatch.length < 2) return null;

  return (
    tryBuildGreedy(sortForTarget(perMatch, target), target, maxLegs) ??
    tryBuildGreedy(
      [...perMatch].sort((a, b) => b.decimalOdds - a.decimalOdds),
      target,
      maxLegs
    )
  );
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

/** Greedy + combo acca to land near the target odds window. */
export function buildForTarget(
  pool: BuilderLeg[],
  target: OddsTarget,
  maxLegs: number,
  scope: BuilderScope = "multi"
): BuilderSlip | null {
  const minRate = minRateForTarget(target, pool.length);
  const filtered = pool.filter(
    (l) => l.hitRate >= minRate && l.sample >= minSampleForTarget(target)
  );
  const candidates = sortForTarget(filtered, target);
  if (!candidates.length) return null;

  const ceiling = maxAchievableOdds(candidates, maxLegs);
  if (ceiling < target.decimalMin) return null;

  const useCombo = scope !== "multi" && candidates.length <= 28;
  let chosen =
    (useCombo ? tryBuildCombo(candidates, target, maxLegs) : null) ??
    (scope === "multi"
      ? tryBuildPerMatch(candidates, target, maxLegs)
      : null) ??
    tryBuildGreedy(candidates, target, maxLegs) ??
    tryBuildPerMatch(candidates, target, maxLegs);

  if (!chosen && target.decimalMin >= 9) {
    const alt = sortForTarget(
      pool.filter((l) => l.hitRate >= 0.55 && l.sample >= 2),
      target
    );
    chosen =
      tryBuildGreedy(alt, target, maxLegs) ?? tryBuildPerMatch(alt, target, maxLegs);
  }

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
  const candidates = pool
    .filter((l) => l.sample >= 2 && l.hitRate >= 0.75)
    .sort((a, b) => b.hitRate - a.hitRate || b.sample - a.sample)
    .slice(0, pool.length > 40 ? 24 : pool.length);

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
  return {
    todaysPick: buildTodaysPick(scoped, options.maxLegs),
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
  const bucket =
    precomputed.byMaxLegs[String(options.maxLegs)] ??
    precomputed.byMaxLegs["8"];
  if (!bucket) return null;
  if (options.scope === "single" && options.matchId != null) {
    return bucket.single[String(options.matchId)] ?? null;
  }
  if (options.scope === "today") return bucket.today;
  return bucket.multi;
}

export type { BuilderComposedView } from "./types";
export { ODDS_TARGETS };
