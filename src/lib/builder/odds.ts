import { toFractional } from "@/lib/format";
import { bet365DecimalOdds, snapBet365Decimal } from "./bet365";
import type { Bet365OddsSource } from "./bet365";
import type { LegCategory } from "./types";

export { snapBet365Decimal, bet365DecimalOdds } from "./bet365";

/** Shrink extreme small-sample rates toward a prior. */
export function effectiveHitRate(rate: number, sample: number): number {
  const prior = 0.68;
  const k = 4;
  const shrunk = (rate * sample + prior * k) / (sample + k);
  return Math.min(0.94, Math.max(0.52, shrunk));
}

export function combineOdds(legs: { decimalOdds: number }[]): number {
  if (!legs.length) return 1;
  return snapBet365Decimal(
    legs.reduce((acc, l) => acc * l.decimalOdds, 1)
  );
}

export function combineProbability(legs: { hitRate: number }[]): number {
  if (!legs.length) return 0;
  return legs.reduce((acc, l) => acc * l.hitRate, 1);
}

export const ODDS_TARGETS = [
  { id: "evens", label: "Evens (1/1)", decimalMin: 1.9, decimalMax: 2.1 },
  { id: "2-1", label: "2/1", decimalMin: 2.8, decimalMax: 3.3 },
  { id: "5-1", label: "5/1", decimalMin: 5.5, decimalMax: 6.5 },
  { id: "10-1", label: "10/1", decimalMin: 9.5, decimalMax: 12 },
  { id: "20-1", label: "20/1", decimalMin: 18, decimalMax: 23 },
  { id: "50-1", label: "50/1", decimalMin: 45, decimalMax: 55 },
] as const;

export function applyBet365Price(
  hitRate: number,
  sample: number,
  category: LegCategory,
  liveDecimal?: number
): {
  decimalOdds: number;
  fractionalOdds: string;
  oddsSource: Bet365OddsSource;
} {
  const rate = effectiveHitRate(hitRate, sample);
  if (liveDecimal && liveDecimal > 1) {
    const decimalOdds = snapBet365Decimal(liveDecimal);
    return {
      decimalOdds,
      fractionalOdds: toFractional(decimalOdds),
      oddsSource: "bet365_live",
    };
  }
  const decimalOdds = bet365DecimalOdds(rate, category);
  return {
    decimalOdds,
    fractionalOdds: toFractional(decimalOdds),
    oddsSource: "bet365_calibrated",
  };
}
