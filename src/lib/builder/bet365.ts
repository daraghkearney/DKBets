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

const WC_LEAGUE = "international-fifa-world-cup";

/** Cap implied probability — Bet365 shortens less aggressively than raw hit rate. */
const MAX_IMPLIED: Record<LegCategory, number> = {
  fouls: 0.86,
  foulsWon: 0.84,
  shots: 0.975,
  sot: 0.92,
  tackles: 0.86,
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

/** Bet365 market names that carry player props we use in the builder. */
const PROP_MARKET_HINTS = [
  "player shot",
  "player tackle",
  "player foul",
  "fouled",
  "to be fouled",
  "fouls won",
  "player card",
  "player booking",
  "other player prop",
  "player prop",
];

export function snapBet365Decimal(decimal: number): number {
  const frac = toFractional(Math.max(1.01, decimal));
  const [n, d] = frac.split("/").map(Number);
  if (!n || !d) return Math.round(decimal * 1000) / 1000;
  return Math.round((1 + n / d) * 1000) / 1000;
}

/** Bet365 Bet Builder banker curves — high hit-rate props price much shorter than fair odds. */
const BB_BANKER: Partial<
  Record<LegCategory, { floor: number; base: number; slope: number; cap: number }>
> = {
  shots: { floor: 0.78, base: 0.9, slope: 1.25, cap: 0.975 },
  sot: { floor: 0.68, base: 0.78, slope: 0.85, cap: 0.9 },
  fouls: { floor: 0.78, base: 0.82, slope: 0.85, cap: 0.86 },
  foulsWon: { floor: 0.72, base: 0.78, slope: 0.65, cap: 0.86 },
  tackles: { floor: 0.78, base: 0.82, slope: 0.85, cap: 0.86 },
};

function standardImplied(rate: number, category: LegCategory): number {
  return Math.min(
    MAX_IMPLIED[category] ?? 0.88,
    rate * (MARGIN[category] ?? 0.96)
  );
}

/** Calibrated Bet365 decimal price from hit rate (Bet Builder ladder). */
export function bet365DecimalOdds(rate: number, category: LegCategory): number {
  const clamped = Math.min(0.99, Math.max(0.52, rate));
  const banker = BB_BANKER[category];

  if (banker && clamped >= banker.floor) {
    const implied = Math.min(
      banker.cap,
      banker.base + (clamped - banker.floor) * banker.slope
    );
    return snapBet365Decimal(1 / implied);
  }

  return snapBet365Decimal(1 / standardImplied(clamped, category));
}

export function bet365FractionalOdds(rate: number, category: LegCategory): string {
  return toFractional(bet365DecimalOdds(rate, category));
}

export type Bet365OddsSource = "bet365_live";

export function liveOddsLookupKey(
  matchId: number,
  playerName: string,
  category: LegCategory
): string {
  return `${matchId}|${normPlayer(playerName)}|${category}`;
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
    if (Number(mid) !== matchId || cat !== category) continue;
    if (player === target || playersMatch(player, target)) return price;
  }
  return undefined;
}

function playersMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aLast = a.split(" ").pop() ?? "";
  const bLast = b.split(" ").pop() ?? "";
  return aLast.length > 2 && aLast === bLast;
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
  if (n.includes("fouled") || (n.includes("foul") && n.includes("won"))) return "foulsWon";
  if (n.includes("shot") && (n.includes("target") || n.includes("on target")))
    return "sot";
  if (n.includes("shot")) return "shots";
  if (n.includes("tackle")) return "tackles";
  if (n.includes("foul")) return "fouls";
  if (n.includes("card") || n.includes("booking")) return "cards";
  return null;
}

function categoryFromSelectionLabel(label: string, rowName?: string): LegCategory | null {
  const text = `${label} ${rowName ?? ""}`.toLowerCase();
  if (
    text.includes("to be fouled") ||
    text.includes("fouled") ||
    (text.includes("foul") && text.includes("won"))
  )
    return "foulsWon";
  if (text.includes("foul") && (text.includes("commit") || text.includes("concede")))
    return "fouls";
  if (text.includes("shot") && (text.includes("target") || text.includes("on target")))
    return "sot";
  if (text.includes("foul")) return "fouls";
  if (text.includes("tackle")) return "tackles";
  if (text.includes("card") || text.includes("booked") || text.includes("booking"))
    return "cards";
  if (text.includes("shot")) return "shots";
  return null;
}

function isPropMarket(name: string): boolean {
  const n = name.toLowerCase();
  return PROP_MARKET_HINTS.some((hint) => n.includes(hint));
}

function extractPlayerName(label: string, rowName?: string): string {
  const combined = rowName ? `${label} ${rowName}` : label;
  const dashSplit = combined.split(/\s[-–—]\s/);
  if (dashSplit.length > 1) {
    const tail = dashSplit.slice(1).join(" ").toLowerCase();
    if (
      tail.includes("shot") ||
      tail.includes("tackle") ||
      tail.includes("foul") ||
      tail.includes("card")
    ) {
      return dashSplit[0]!.trim();
    }
  }
  if (rowName && categoryFromSelectionLabel(label, rowName)) return label.trim();
  return combined.replace(/\s[-–—]\s.*$/, "").trim() || label.trim();
}

function isOnePlusLine(label: string, rowName?: string, hdp?: number): boolean {
  const text = `${label} ${rowName ?? ""}`.toLowerCase();
  if (/\b(2|3|4|5)\+\s/.test(text) || /\b(2|3|4|5)\+\s*(shots|sot|tackle|foul)/i.test(text))
    return false;
  if (/\bover\s*[2-9]|under\s*[0-9]/i.test(text)) return false;
  if (hdp !== undefined && Number.isFinite(hdp) && hdp > 0.5) return false;
  return true;
}

function storeLivePrice(
  out: Map<string, number>,
  matchId: number,
  playerName: string,
  category: LegCategory,
  decimal: number,
  hdp?: number
): void {
  if (!playerName) return;
  const key = liveOddsLookupKey(matchId, playerName, category);
  const existing = out.get(key);
  // Prefer 0.5 line (1+) over any previously stored higher line
  if (existing && hdp !== undefined && hdp > 0.5) return;
  out.set(key, Math.round(decimal * 1000) / 1000);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function fetchJson(url: URL): Promise<any | null> {
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  return res.json();
}

function teamsMatch(home: string, away: string, ev: any): boolean {
  const eh = normTeam(String(ev.home ?? ""));
  const ea = normTeam(String(ev.away ?? ""));
  const h = normTeam(home);
  const a = normTeam(away);
  return (eh === h && ea === a) || (eh === a && ea === h);
}

async function searchOddsApiEvent(
  key: string,
  home: string,
  away: string
): Promise<number | null> {
  for (const query of [`${home} ${away}`, home, away]) {
    const url = new URL("https://api.odds-api.io/v3/events/search");
    url.searchParams.set("apiKey", key);
    url.searchParams.set("query", query);
    const events = await fetchJson(url);
    if (!Array.isArray(events)) continue;
    const hit = events.find((ev) => teamsMatch(home, away, ev));
    if (hit?.id) return Number(hit.id);
  }
  return null;
}

/** Map FotMob fixtures → odds-api.io event IDs via World Cup league + search. */
async function resolveOddsApiEvents(
  key: string,
  fixtures: FixtureRef[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const unmatched = [...fixtures];

  const leagueUrl = new URL("https://api.odds-api.io/v3/events");
  leagueUrl.searchParams.set("apiKey", key);
  leagueUrl.searchParams.set("sport", "football");
  leagueUrl.searchParams.set("league", WC_LEAGUE);
  leagueUrl.searchParams.set("bookmaker", "Bet365");
  leagueUrl.searchParams.set("status", "pending");
  leagueUrl.searchParams.set("limit", "500");

  const leagueEvents = await fetchJson(leagueUrl);
  if (Array.isArray(leagueEvents)) {
    for (const fx of fixtures) {
      const hit = leagueEvents.find((ev) => teamsMatch(fx.home, fx.away, ev));
      if (hit?.id) {
        out.set(fx.id, Number(hit.id));
      }
    }
  }

  for (const fx of fixtures) {
    if (out.has(fx.id)) continue;
    const apiId = await searchOddsApiEvent(key, fx.home, fx.away);
    if (apiId) out.set(fx.id, apiId);
  }

  return out;
}

async function fetchOddsMulti(
  key: string,
  apiEventIds: number[]
): Promise<any[]> {
  if (!apiEventIds.length) return [];
  const url = new URL("https://api.odds-api.io/v3/odds/multi");
  url.searchParams.set("apiKey", key);
  url.searchParams.set("eventIds", apiEventIds.join(","));
  url.searchParams.set("bookmakers", "Bet365");
  const data = await fetchJson(url);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return [data];
  return [];
}

async function ensureBet365Selected(key: string): Promise<void> {
  const url = new URL("https://api.odds-api.io/v3/bookmakers/selected/select");
  url.searchParams.set("apiKey", key);
  url.searchParams.set("bookmakers", "Bet365");
  try {
    await fetch(url.toString(), { method: "PUT", signal: AbortSignal.timeout(10_000) });
  } catch {
    /* non-fatal */
  }
}

/** Optional live Bet365 player props via odds-api.io (set ODDS_API_IO_KEY in CI). */
export async function fetchBet365LiveOdds(
  fixtures: FixtureRef[]
): Promise<Map<string, number>> {
  const key = process.env.ODDS_API_IO_KEY;
  if (!key || fixtures.length === 0) return new Map();

  const out = new Map<string, number>();
  try {
    await ensureBet365Selected(key);
    const eventMap = await resolveOddsApiEvents(key, fixtures);
    if (eventMap.size === 0) {
      console.warn("  bet365 live: no odds-api.io events matched for World Cup fixtures");
      return out;
    }

    const apiToFotmob = new Map<number, number>();
    for (const [fotmobId, apiId] of eventMap) {
      apiToFotmob.set(apiId, fotmobId);
    }

    const apiIds = [...eventMap.values()];
    for (let i = 0; i < apiIds.length; i += 10) {
      const batch = apiIds.slice(i, i + 10);
      const responses = await fetchOddsMulti(key, batch);
      for (const data of responses) {
        const apiEventId = Number(data?.id ?? data?.eventId);
        const fotmobId =
          apiToFotmob.get(apiEventId) ??
          [...eventMap.entries()].find(([, apiId]) => apiId === apiEventId)?.[0];
        if (fotmobId) parseOddsApiResponse(data, fotmobId, out);
      }
    }
  } catch (e) {
    console.warn("  bet365 live fetch failed:", e);
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
  }
}

function parseOddsApiMarket(
  market: any,
  fotmobMatchId: number,
  out: Map<string, number>
): void {
  const marketName = String(market?.name ?? market?.marketName ?? "");
  if (!isPropMarket(marketName) && !categoryFromMarketName(marketName)) return;

  const defaultCategory = categoryFromMarketName(marketName);
  const rows = market?.odds ?? market?.outcomes ?? market?.selections ?? [];

  for (const row of rows as any[]) {
    const label = String(row?.label ?? row?.participant ?? "").trim();
    const rowName = String(row?.name ?? "").trim();
    if (!label && !rowName) continue;

    const category =
      categoryFromSelectionLabel(label, rowName) ?? defaultCategory;
    if (!category) continue;

    const player = extractPlayerName(label || rowName, rowName || undefined);
    const hdp = Number(row?.hdp ?? row?.handicap ?? row?.line);
    const hasHdp = Number.isFinite(hdp);

    if (!isOnePlusLine(label, rowName, hasHdp ? hdp : undefined)) continue;

    const over = parseDecimal(row?.over);
    const yes = parseDecimal(row?.yes);

    if (over && (!hasHdp || hdp <= 0.5)) {
      storeLivePrice(out, fotmobMatchId, player, category, over, hasHdp ? hdp : 0.5);
      continue;
    }

    if (yes && category === "cards") {
      storeLivePrice(out, fotmobMatchId, player, category, yes);
      continue;
    }

    const price = parseDecimal(row?.price ?? row?.odds ?? row?.decimal);
    if (price) {
      storeLivePrice(out, fotmobMatchId, player, category, price);
    }
  }
}
