import { ODDS_TARGETS } from "./odds";
import { slipFromLegs } from "./legs";
import type { BuilderLeg, BuilderSlip, OddsTarget } from "./types";

export type BuilderScope = "single" | "today" | "multi";

export interface BuilderOptions {
  scope: BuilderScope;
  /** Required when scope is "single" */
  matchId?: number;
  maxLegs: number;
  /** When true, only legs with live Bet365 prices are used */
  liveOnly?: boolean;
}

function legConflict(a: BuilderLeg, b: BuilderLeg): boolean {
  if (a.matchId !== b.matchId) return false;
  if (a.playerName && b.playerName && a.playerName === b.playerName) return true;
  return a.market === b.market;
}

function canAdd(chosen: BuilderLeg[], leg: BuilderLeg): boolean {
  return !chosen.some((c) => legConflict(c, leg));
}

function minRateForTarget(target: OddsTarget): number {
  if (target.decimalMax <= 2.5) return 0.82;
  if (target.decimalMax <= 4) return 0.76;
  if (target.decimalMax <= 7) return 0.72;
  if (target.decimalMax <= 13) return 0.66;
  if (target.decimalMax <= 24) return 0.62;
  return 0.58;
}

function minSampleForTarget(target: OddsTarget): number {
  return target.decimalMax <= 13 ? 3 : 2;
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

/** Greedy safest-first acca to land near the target odds window. */
export function buildForTarget(
  pool: BuilderLeg[],
  target: OddsTarget,
  maxLegs: number
): BuilderSlip | null {
  const candidates = sortForTarget(
    pool.filter(
      (l) =>
        l.hitRate >= minRateForTarget(target) &&
        l.sample >= minSampleForTarget(target)
    ),
    target
  );

  if (!candidates.length) return null;

  const chosen: BuilderLeg[] = [];
  let odds = 1;

  for (const leg of candidates) {
    if (chosen.length >= maxLegs) break;
    if (!canAdd(chosen, leg)) continue;
    chosen.push(leg);
    odds = Math.round(odds * leg.decimalOdds * 100) / 100;
    if (odds >= target.decimalMin && odds <= target.decimalMax) break;
    if (odds > target.decimalMax * 1.2) {
      chosen.pop();
      odds = Math.round((odds / leg.decimalOdds) * 100) / 100;
    }
  }

  if (!chosen.length) return null;

  const combined =
    Math.round(chosen.reduce((acc, l) => acc * l.decimalOdds, 1) * 100) / 100;

  if (combined < target.decimalMin * 0.85) {
    if (target.decimalMin >= 9) {
      const alt = sortForTarget(
        pool.filter((l) => l.hitRate >= 0.55 && l.sample >= 2),
        target
      );
      const altChosen: BuilderLeg[] = [];
      let altOdds = 1;
      for (const leg of alt) {
        if (altChosen.length >= maxLegs) break;
        if (!canAdd(altChosen, leg)) continue;
        altChosen.push(leg);
        altOdds = Math.round(altOdds * leg.decimalOdds * 100) / 100;
        if (altOdds >= target.decimalMin) {
          return slipFromLegs(
            `builder-${target.id}`,
            `Bet365 Builder — ${target.label}`,
            altChosen,
            target.label
          );
        }
      }
    }
    return null;
  }

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
    .filter((l) => l.sample >= 3 && l.hitRate >= 0.78)
    .sort((a, b) => b.hitRate - a.hitRate || b.sample - a.sample);

  if (!candidates.length) return null;

  const single = candidates.find((l) => l.hitRate >= 0.88 && l.sample >= 4);
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
        if (prob >= 0.82 && prob > bestPairProb) {
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
    for (let i = 0; i < Math.min(candidates.length, 15); i++) {
      for (let j = i + 1; j < Math.min(candidates.length, 20); j++) {
        for (let k = j + 1; k < Math.min(candidates.length, 25); k++) {
          const legs = [candidates[i], candidates[j], candidates[k]];
          if (!canAdd([legs[0]], legs[1]) || !canAdd([legs[0], legs[1]], legs[2]))
            continue;
          const prob = legs.reduce((acc, l) => acc * l.hitRate, 1);
          if (prob >= 0.78 && prob > bestTripleProb) {
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
  maxLegs: number
): Record<string, BuilderSlip | null> {
  const out: Record<string, BuilderSlip | null> = {};
  for (const target of ODDS_TARGETS) {
    out[target.id] = buildForTarget(pool, target, maxLegs);
  }
  return out;
}

/** Compose full builder view client-side from exported leg pool. */
export function composeBuilderView(
  pool: BuilderLeg[],
  options: BuilderOptions
): {
  todaysPick: BuilderSlip | null;
  builders: Record<string, BuilderSlip | null>;
} {
  let scoped = filterLegsByScope(pool, options);
  if (options.liveOnly) {
    scoped = scoped.filter((l) => l.oddsSource === "bet365_live");
  }
  return {
    todaysPick: buildTodaysPick(scoped, options.maxLegs),
    builders: buildAllTargets(scoped, options.maxLegs),
  };
}

export { ODDS_TARGETS };
