import { slipFromLegs } from "./legs";
import type { BuilderLeg, UnderpricedGem } from "./types";

export type { UnderpricedGem } from "./types";

function impliedProbability(decimalOdds: number): number {
  return 1 / decimalOdds;
}

function gemScore(leg: BuilderLeg): number {
  const implied = impliedProbability(leg.decimalOdds);
  const edge = leg.hitRate - implied;
  if (edge < 0.04 || leg.sample < 2) return -1;

  let score = edge;

  if (leg.h2hSample && leg.h2hSample >= 2 && leg.h2hHits != null) {
    const h2hRate = leg.h2hHits / leg.h2hSample;
    if (h2hRate >= leg.hitRate - 0.05) score += 0.025;
    score += Math.min(0.04, leg.h2hSample * 0.008);
  }

  if (leg.tournamentSample && leg.tournamentSample >= 2) {
    const tRate = (leg.tournamentHits ?? 0) / leg.tournamentSample;
    if (tRate >= 0.65) score += 0.015;
  }

  score += Math.min(0.03, leg.sample * 0.004);

  if (leg.decimalOdds >= 1.85 && edge >= 0.07) score += 0.02;
  if (leg.type === "team" && edge >= 0.06) score += 0.015;

  return score;
}

function formatPctShort(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function buildGemDescription(leg: BuilderLeg): string {
  const implied = impliedProbability(leg.decimalOdds);
  const edgePts = Math.round((leg.hitRate - implied) * 100);
  const clauses: string[] = [];

  if (leg.type === "team" && leg.teamName) {
    clauses.push(
      `${leg.teamName} have hit this team market in ${leg.tournamentHits ?? 0}/${leg.tournamentSample ?? leg.sample} World Cup games`
    );
  } else if (leg.playerName) {
    clauses.push(
      `${leg.playerName} lands this stat in ${formatPctShort(leg.hitRate)} of relevant games`
    );
    if (leg.tournamentSample && leg.tournamentSample >= 2) {
      clauses.push(
        `tournament form ${leg.tournamentHits}/${leg.tournamentSample}`
      );
    }
    if (leg.h2hSample && leg.h2hSample >= 2 && leg.h2hHits != null) {
      clauses.push(
        `direct matchup history ${leg.h2hHits}/${leg.h2hSample} when facing this opponent type`
      );
    }
  }

  if (leg.matchupLabel) {
    clauses.push(`positional duel context: ${leg.matchupLabel}`);
  }

  clauses.push(
    `Bet365's ${leg.fractionalOdds} (${leg.decimalOdds.toFixed(2)}) implies ${formatPctShort(implied)} — we see ~${edgePts} pts of value`
  );

  return `${clauses.join(". ")}.`;
}

/** Best single-leg value pick in scope — stats vs live Bet365 implied odds. */
export function buildUnderpricedGem(
  pool: BuilderLeg[],
  excludeLegIds: string[] = []
): UnderpricedGem | null {
  const excluded = new Set(excludeLegIds);
  let best: BuilderLeg | null = null;
  let bestScore = 0;

  for (const leg of pool) {
    if (excluded.has(leg.id)) continue;
    const score = gemScore(leg);
    if (score > bestScore) {
      bestScore = score;
      best = leg;
    }
  }

  if (!best) return null;

  const implied = impliedProbability(best.decimalOdds);
  return {
    slip: slipFromLegs("underpriced-gem", "Underpriced Gem", [best]),
    description: buildGemDescription(best),
    edgePct: Math.round((best.hitRate - implied) * 1000) / 10,
  };
}
