import { toFractional } from "@/lib/format";

/** Shrink extreme small-sample rates toward a prior. */
export function effectiveHitRate(rate: number, sample: number): number {
  const prior = 0.68;
  const k = 4;
  const shrunk = (rate * sample + prior * k) / (sample + k);
  return Math.min(0.94, Math.max(0.52, shrunk));
}

/** Estimate Bet365-style decimal price from historical hit rate. */
export function estimateDecimalOdds(hitRate: number, sample = 3): number {
  const r = effectiveHitRate(hitRate, sample);
  const fair = 1 / r;
  return Math.round(Math.max(1.08, fair * 0.9) * 100) / 100;
}

export function fractionalFromDecimal(decimal: number): string {
  return toFractional(decimal);
}

export function combineOdds(legs: { decimalOdds: number }[]): number {
  if (!legs.length) return 1;
  return (
    Math.round(legs.reduce((acc, l) => acc * l.decimalOdds, 1) * 100) / 100
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
