import {
  buildForTarget,
  filterBuilderLegs,
  lookupPrecomputedView,
  type BuilderOptions,
  type BuilderScope,
} from "./compose";
import { buildUnderpricedGem } from "./gem";
import { slipFromLegs } from "./legs";
import { ODDS_TARGETS } from "./odds";
import type {
  BuilderComposedView,
  BuilderLeg,
  BuilderPrecomputed,
  BuilderSlip,
  OddsTarget,
} from "./types";

function sortByContext(candidates: BuilderLeg[]): BuilderLeg[] {
  return [...candidates].sort(
    (a, b) =>
      (b.contextScore ?? 0) - (a.contextScore ?? 0) ||
      b.hitRate - a.hitRate ||
      (b.contextNotes?.length ?? 0) - (a.contextNotes?.length ?? 0) ||
      b.sample - a.sample
  );
}

function contextPool(pool: BuilderLeg[]): BuilderLeg[] {
  const backed = pool.filter((l) => l.contextBacked);
  return backed.length >= 2
    ? backed
    : pool.filter((l) => (l.contextScore ?? 0) >= 0.25);
}

function buildContextTodaysPick(
  pool: BuilderLeg[],
  maxLegs: number
): BuilderSlip | null {
  const candidates = sortByContext(
    pool.filter(
      (l) =>
        l.sample >= 2 &&
        l.hitRate >= 0.65 &&
        (l.contextScore ?? 0) >= 0.4
    )
  );
  if (!candidates.length) return null;

  const top = candidates[0];
  if (top.hitRate >= 0.78 && (top.contextScore ?? 0) >= 0.55) {
    return {
      ...slipFromLegs("context-todays-pick", "Context Pick — Banker", [top]),
      contextSummary: top.contextNotes?.[0],
    };
  }

  if (maxLegs >= 2) {
    for (let i = 0; i < Math.min(candidates.length, 20); i++) {
      for (let j = i + 1; j < Math.min(candidates.length, 25); j++) {
        const a = candidates[i];
        const b = candidates[j];
        if (a.matchId === b.matchId && a.playerName === b.playerName) continue;
        const prob = a.hitRate * b.hitRate;
        const ctx = (a.contextScore ?? 0) + (b.contextScore ?? 0);
        if (prob >= 0.68 && ctx >= 0.9) {
          return {
            ...slipFromLegs("context-todays-pick", "Context Pick — Double", [
              a,
              b,
            ]),
            contextSummary:
              "Dual context-backed legs with strong H2H/tactical support.",
          };
        }
      }
    }
  }

  return {
    ...slipFromLegs(
      "context-todays-pick",
      "Context Pick — Best supported",
      [top]
    ),
    contextSummary: top.contextNotes?.[0],
  };
}

function buildContextForTarget(
  pool: BuilderLeg[],
  target: OddsTarget,
  maxLegs: number,
  scope: BuilderScope
): BuilderSlip | null {
  const ranked = sortByContext(
    pool.filter((l) => l.sample >= 2 && l.hitRate >= 0.52)
  );
  const slip = buildForTarget(ranked, target, maxLegs, scope);
  if (!slip) return null;

  const avgCtx =
    slip.legs.reduce((s, l) => s + (l.contextScore ?? 0), 0) /
    slip.legs.length;
  return {
    ...slip,
    title: `Context Builder — ${target.label}`,
    contextSummary:
      avgCtx >= 0.5
        ? `${slip.legs.length} legs backed by matchup, H2H and tactical research (avg context ${Math.round(avgCtx * 100)}%).`
        : "Best available context-supported combination in this odds band.",
  };
}

/** Compose builder view prioritising context-backed legs. */
export function composeContextBuilderView(
  pool: BuilderLeg[],
  options: BuilderOptions
): BuilderComposedView {
  const scoped = contextPool(filterBuilderLegs(pool, options));
  const todaysPick = buildContextTodaysPick(scoped, options.maxLegs);
  const excludeIds = todaysPick?.legs.map((l) => l.id) ?? [];

  const builders: Record<string, BuilderSlip | null> = {};
  for (const target of ODDS_TARGETS) {
    builders[target.id] = buildContextForTarget(
      scoped,
      target,
      options.maxLegs,
      options.scope
    );
  }

  return {
    todaysPick,
    underpricedGem: buildUnderpricedGem(scoped, excludeIds),
    builders,
  };
}

export function precomputeContextBuilderViews(
  pool: BuilderLeg[],
  fixtures: Array<{ id: number }>,
  maxLegsValues: number[] = [8]
): BuilderPrecomputed {
  const byMaxLegs: BuilderPrecomputed["byMaxLegs"] = {};

  for (const maxLegs of maxLegsValues) {
    const key = String(maxLegs);
    const single: Record<string, BuilderComposedView> = {};
    for (const fx of fixtures) {
      single[String(fx.id)] = composeContextBuilderView(pool, {
        scope: "single",
        matchId: fx.id,
        maxLegs,
      });
    }
    byMaxLegs[key] = {
      today: composeContextBuilderView(pool, { scope: "today", maxLegs }),
      multi: composeContextBuilderView(pool, { scope: "multi", maxLegs }),
      single,
    };
  }

  return { byMaxLegs };
}

export function lookupContextPrecomputedView(
  precomputed: BuilderPrecomputed | undefined,
  options: BuilderOptions
): BuilderComposedView | null {
  return lookupPrecomputedView(precomputed, options);
}
