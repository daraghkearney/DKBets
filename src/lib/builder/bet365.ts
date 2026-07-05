/**
 * Bet365-only pricing for the Bet Builder section.
 * Uses live odds when ODDS_API_IO_KEY is set at export time; otherwise
 * calibrates to Bet365's typical player-prop ladder (not naive fair odds).
 */

import { toFractional } from "@/lib/format";
import type { LegCategory } from "./types";

/** Cap implied probability — Bet365 shortens less aggressively than raw hit rate. */
const MAX_IMPLIED: Record<LegCategory, number> = {
  fouls: 0.86,
  foulsWon: 0.84,
  shots: 0.88,
  sot: 0.85,
  tackles: 0.87,
  cards: 0.78,
  team: 0.82,
};

/** Typical Bet365 margin on player props vs raw hit rate. */
const MARGIN: Record<LegCategory, number> = {
  fouls: 0.98,
  foulsWon: 0.97,
  shots: 0.95,
  sot: 0.96,
  tackles: 0.97,
  cards: 0.92,
  team: 0.94,
};

export function snapBet365Decimal(decimal: number): number {
  const frac = toFractional(Math.max(1.05, decimal));
  const [n, d] = frac.split("/").map(Number);
  if (!n || !d) return Math.round(decimal * 100) / 100;
  return Math.round((1 + n / d) * 100) / 100;
}

/** Calibrated Bet365 decimal price from hit rate (matches BB ladder, e.g. ~1/6 fouls). */
export function bet365DecimalOdds(rate: number, category: LegCategory): number {
  const clamped = Math.min(0.94, Math.max(0.52, rate));
  const implied = Math.min(
    MAX_IMPLIED[category] ?? 0.88,
    clamped * (MARGIN[category] ?? 0.96)
  );
  return snapBet365Decimal(1 / implied);
}

export function bet365FractionalOdds(rate: number, category: LegCategory): string {
  return toFractional(bet365DecimalOdds(rate, category));
}

export type Bet365OddsSource = "bet365_live" | "bet365_calibrated";

/** Key for matching live Bet365 prices to legs. */
export function legOddsKey(
  matchId: number,
  playerName: string | undefined,
  market: string
): string {
  return `${matchId}|${(playerName ?? market).toLowerCase()}|${market.toLowerCase()}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Optional live Bet365 player props via odds-api.io (set ODDS_API_IO_KEY in CI). */
export async function fetchBet365LiveOdds(
  fixtureIds: number[]
): Promise<Map<string, number>> {
  const key = process.env.ODDS_API_IO_KEY;
  if (!key || fixtureIds.length === 0) return new Map();

  const out = new Map<string, number>();
  try {
    for (const eventId of fixtureIds.slice(0, 8)) {
      const url = new URL("https://api.odds-api.io/v3/odds");
      url.searchParams.set("apiKey", key);
      url.searchParams.set("eventId", String(eventId));
      url.searchParams.set("bookmakers", "Bet365");

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as any;
      parseOddsApiMarkets(data, eventId, out);
    }
  } catch {
    /* fall back to calibrated */
  }
  return out;
}

function parseOddsApiMarkets(
  data: any,
  eventId: number,
  out: Map<string, number>
): void {
  const markets = data?.markets ?? data?.bookmakers?.[0]?.markets ?? [];
  for (const m of markets as any[]) {
    const name = String(m.name ?? m.marketName ?? "").toLowerCase();
    if (
      !name.includes("player") &&
      !name.includes("foul") &&
      !name.includes("shot") &&
      !name.includes("card") &&
      !name.includes("tackle")
    ) {
      continue;
    }
    for (const o of m.outcomes ?? m.selections ?? []) {
      const player = o.participant ?? o.name ?? o.label ?? "";
      const price = Number(o.price ?? o.odds ?? o.decimal);
      if (!player || !Number.isFinite(price) || price <= 1) continue;
      out.set(
        legOddsKey(eventId, String(player), String(o.name ?? o.label ?? name)),
        price
      );
    }
  }
}
