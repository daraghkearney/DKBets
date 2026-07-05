/**
 * Bet365-only pricing for the Bet Builder section.
 * Uses live odds when ODDS_API_IO_KEY is set at export time; otherwise
 * calibrates to Bet365's typical player-prop ladder (not naive fair odds).
 */

import { toFractional } from "@/lib/format";
import type { LegCategory } from "./types";

export interface FixtureRef {
  id: number;
  home: string;
  away: string;
}

/** Cap implied probability — Bet365 shortens less aggressively than raw hit rate. */
const MAX_IMPLIED: Record<LegCategory, number> = {
  fouls: 0.86,
  foulsWon: 0.84,
  shots: 0.975,
  sot: 0.92,
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
  const frac = toFractional(Math.max(1.01, decimal));
  const [n, d] = frac.split("/").map(Number);
  if (!n || !d) return Math.round(decimal * 1000) / 1000;
  return Math.round((1 + n / d) * 1000) / 1000;
}

/** Calibrated Bet365 decimal price from hit rate (matches BB ladder, e.g. ~1/6 fouls). */
export function bet365DecimalOdds(rate: number, category: LegCategory): number {
  const clamped = Math.min(0.99, Math.max(0.52, rate));

  // Banker 1+ shot lines (e.g. Vinícius) price at 1/40–1/10 on Bet365.
  if (category === "shots" && clamped >= 0.78) {
    const implied = Math.min(0.975, 0.9 + (clamped - 0.78) * 1.25);
    return snapBet365Decimal(1 / implied);
  }

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

/** Key for matching live Bet365 prices to legs (by player + category). */
export function liveOddsLookupKey(
  matchId: number,
  playerName: string,
  category: LegCategory
): string {
  return `${matchId}|${normPlayer(playerName)}|${category}`;
}

/** @deprecated Use liveOddsLookupKey for live prices */
export function legOddsKey(
  matchId: number,
  playerName: string | undefined,
  market: string
): string {
  return `${matchId}|${(playerName ?? market).toLowerCase()}|${market.toLowerCase()}`;
}

export function findLivePrice(
  liveOdds: Map<string, number> | undefined,
  matchId: number,
  playerName: string | undefined,
  category: LegCategory
): number | undefined {
  if (!liveOdds || !playerName) return undefined;
  const exact = liveOdds.get(liveOddsLookupKey(matchId, playerName, category));
  if (exact) return exact;
  const target = normPlayer(playerName);
  for (const [key, price] of liveOdds) {
    const [mid, player, cat] = key.split("|");
    if (Number(mid) === matchId && cat === category && player === target) {
      return price;
    }
  }
  return undefined;
}

function normTeam(team: string): string {
  const t = team.trim().toLowerCase().replace(/\./g, "");
  if (t === "united states") return "usa";
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function normPlayer(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDecimal(value: unknown): number | undefined {
  if (typeof value === "number" && value > 1) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n) && n > 1) return n;
  }
  return undefined;
}

function categoryFromMarketName(name: string): LegCategory | null {
  const n = name.toLowerCase();
  if (n.includes("shot") && (n.includes("target") || n.includes("on target")))
    return "sot";
  if (n.includes("shot")) return "shots";
  if (n.includes("foul")) return "fouls";
  if (n.includes("tackle")) return "tackles";
  if (n.includes("card") || n.includes("booked")) return "cards";
  return null;
}

function storeLivePrice(
  out: Map<string, number>,
  matchId: number,
  playerName: string,
  category: LegCategory,
  decimal: number
): void {
  out.set(liveOddsLookupKey(matchId, playerName, category), snapBet365Decimal(decimal));
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function fetchJson(url: URL): Promise<any | null> {
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  return res.json();
}

/** Map FotMob fixtures → odds-api.io event IDs via team names. */
async function resolveOddsApiEvents(
  key: string,
  fixtures: FixtureRef[]
): Promise<Map<number, number>> {
  const url = new URL("https://api.odds-api.io/v3/events");
  url.searchParams.set("apiKey", key);
  url.searchParams.set("sport", "football");
  url.searchParams.set("bookmaker", "Bet365");
  url.searchParams.set("status", "pending");

  const events = await fetchJson(url);
  if (!Array.isArray(events)) return new Map();

  const out = new Map<number, number>();
  for (const fx of fixtures) {
    const home = normTeam(fx.home);
    const away = normTeam(fx.away);
    const hit = events.find((ev: any) => {
      const eh = normTeam(String(ev.home ?? ""));
      const ea = normTeam(String(ev.away ?? ""));
      return (eh === home && ea === away) || (eh === away && ea === home);
    });
    if (hit?.id) out.set(fx.id, Number(hit.id));
  }
  return out;
}

/** Optional live Bet365 player props via odds-api.io (set ODDS_API_IO_KEY in CI). */
export async function fetchBet365LiveOdds(
  fixtures: FixtureRef[]
): Promise<Map<string, number>> {
  const key = process.env.ODDS_API_IO_KEY;
  if (!key || fixtures.length === 0) return new Map();

  const out = new Map<string, number>();
  try {
    const eventMap = await resolveOddsApiEvents(key, fixtures);
    if (eventMap.size === 0) return out;

    for (const [fotmobId, apiEventId] of eventMap) {
      const url = new URL("https://api.odds-api.io/v3/odds");
      url.searchParams.set("apiKey", key);
      url.searchParams.set("eventId", String(apiEventId));
      url.searchParams.set("bookmakers", "Bet365");

      const data = await fetchJson(url);
      if (data) parseOddsApiResponse(data, fotmobId, out);
    }
  } catch {
    /* fall back to calibrated */
  }
  return out;
}

function parseOddsApiResponse(
  data: any,
  fotmobMatchId: number,
  out: Map<string, number>
): void {
  const bet365 = data?.bookmakers?.Bet365 ?? data?.bookmakers?.bet365;
  if (Array.isArray(bet365)) {
    for (const market of bet365) {
      parseOddsApiMarket(market, fotmobMatchId, out);
    }
    return;
  }
  const markets = data?.markets ?? [];
  if (Array.isArray(markets)) {
    for (const market of markets) parseOddsApiMarket(market, fotmobMatchId, out);
  }
}

function parseOddsApiMarket(
  market: any,
  fotmobMatchId: number,
  out: Map<string, number>
): void {
  const marketName = String(market?.name ?? market?.marketName ?? "");
  const category = categoryFromMarketName(marketName);
  if (!category) return;

  const rows = market?.odds ?? market?.outcomes ?? market?.selections ?? [];
  for (const row of rows as any[]) {
    const label = String(row?.label ?? row?.name ?? row?.participant ?? "");
    if (!label) continue;

    // Over/under style (0.5 line = 1+)
    const hdp = Number(row?.hdp ?? row?.handicap ?? row?.line);
    const over = parseDecimal(row?.over);
    if (over && (hdp === 0.5 || !Number.isFinite(hdp))) {
      storeLivePrice(out, fotmobMatchId, label, category, over);
      continue;
    }

    // Single-price selection e.g. "Vinícius Júnior - 1+ Shots"
    const price = parseDecimal(row?.price ?? row?.odds ?? row?.decimal);
    if (price) {
      const player = label.split(/\s[-–—]\s/)[0]?.trim() || label;
      storeLivePrice(out, fotmobMatchId, player, category, price);
    }
  }
}
