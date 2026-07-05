/**
 * Bet365-only live pricing for the Bet Builder section.
 * Uses odds-api.io when ODDS_API_IO_KEY is set at export time.
 * Stats/hit rates are separate — we never estimate or calibrate odds here.
 */

import { toFractional } from "@/lib/format";
import type { Bet365LiveBundle, Bet365LiveMap, Bet365LiveQuote } from "./bet365-live";
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

/** Exact Bet365 Bet Builder markets — specialty lines (outside box, etc.) are excluded. */
const CANONICAL_MARKET_CATEGORY: Record<string, LegCategory> = {
  "player shots on target": "sot",
  "player shot on target": "sot",
  "player shots": "shots",
  "player shot": "shots",
  "player fouls committed": "fouls",
  "player to be fouled": "foulsWon",
  "to be fouled": "foulsWon",
  "player fouls won": "foulsWon",
  "player tackles": "tackles",
  "player cards": "cards",
  "player bookings": "cards",
  "player to be carded": "cards",
};

const EXCLUDED_PROP_FRAGMENTS = [
  "outside the box",
  "inside the box",
  "outside box",
  "from outside",
  "header",
  "1st half",
  "2nd half",
  "first half",
  "second half",
  "half time",
  "halftime",
  "anytime",
  "goalscorer",
  "to score",
  "assist",
  "passes",
  "cross",
  "offside",
  "alternative",
  "special",
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

export type { Bet365LiveBundle, Bet365LiveMap, Bet365LiveQuote } from "./bet365-live";

export function findLiveQuote(
  liveOdds: Bet365LiveMap | undefined,
  matchId: number,
  playerName: string | undefined,
  category: LegCategory
): Bet365LiveQuote | undefined {
  const price = findLivePrice(liveOdds, matchId, playerName, category);
  if (price === undefined || !liveOdds || !playerName) return undefined;

  const target = normPlayer(playerName);
  const candidates: { player: string; quote: Bet365LiveQuote }[] = [];

  for (const [key, quote] of liveOdds) {
    const parts = key.split("|");
    if (parts.length < 3) continue;
    const mid = Number(parts[0]);
    const cat = parts[parts.length - 1];
    if (mid !== matchId || cat !== category) continue;

    const apiPlayer = normPlayer(parts.slice(1, -1).join("|"));
    if (apiPlayer === target || playersMatch(apiPlayer, target)) {
      candidates.push({ player: apiPlayer, quote });
    }
  }

  if (candidates.length === 0) return { price };
  if (candidates.length === 1) return candidates[0]!.quote;

  const targetParts = target.split(" ").filter(Boolean);
  const targetLast = targetParts[targetParts.length - 1] ?? "";

  if (targetParts.length >= 2 && targetLast) {
    const byLast = candidates.filter((c) => {
      const parts = c.player.split(" ").filter(Boolean);
      return parts[parts.length - 1] === targetLast;
    });
    if (byLast.length === 1) return byLast[0]!.quote;
  }

  if (targetParts.length === 1) {
    const exactMononym = candidates.filter((c) => c.player === target);
    if (exactMononym.length === 1) return exactMononym[0]!.quote;
  }

  return { price };
}

export function findLivePrice(
  liveOdds: Bet365LiveMap | undefined,
  matchId: number,
  playerName: string | undefined,
  category: LegCategory
): number | undefined {
  if (!liveOdds || !playerName) return undefined;

  const target = normPlayer(playerName);
  const candidates: { player: string; price: number }[] = [];

  for (const [key, quote] of liveOdds) {
    const parts = key.split("|");
    if (parts.length < 3) continue;
    const mid = Number(parts[0]);
    const cat = parts[parts.length - 1];
    if (mid !== matchId || cat !== category) continue;

    const apiPlayer = normPlayer(parts.slice(1, -1).join("|"));
    if (apiPlayer === target || playersMatch(apiPlayer, target)) {
      candidates.push({ player: apiPlayer, price: quote.price });
    }
  }

  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0]!.price;

  const targetParts = target.split(" ").filter(Boolean);
  const targetLast = targetParts[targetParts.length - 1] ?? "";

  if (targetParts.length >= 2 && targetLast) {
    const byLast = candidates.filter((c) => {
      const parts = c.player.split(" ").filter(Boolean);
      return parts[parts.length - 1] === targetLast;
    });
    if (byLast.length === 1) return byLast[0]!.price;
  }

  if (targetParts.length === 1) {
    const exactMononym = candidates.filter((c) => c.player === target);
    if (exactMononym.length === 1) return exactMononym[0]!.price;
  }

  return undefined;
}

function playersMatch(apiPlayer: string, statsPlayer: string): boolean {
  if (apiPlayer === statsPlayer) return true;

  const apiParts = apiPlayer.split(" ").filter(Boolean);
  const statsParts = statsPlayer.split(" ").filter(Boolean);

  // Stats mononym must not match a longer API name (Gabriel ≠ Gabriel Martinelli)
  if (statsParts.length === 1) {
    return apiParts.length === 1 && apiParts[0] === statsParts[0];
  }

  // Full stats name vs Bet365 mononym — first name only; disambiguate via last name above
  if (apiParts.length === 1 && statsParts.length >= 2) {
    return statsParts[0] === apiParts[0];
  }

  // Both multi-word — first + last token (handles Gabriel Magalhaes / Gabriel Magalhães)
  if (statsParts.length >= 2 && apiParts.length >= 2) {
    return (
      statsParts[0] === apiParts[0] &&
      statsParts[statsParts.length - 1] === apiParts[apiParts.length - 1]
    );
  }

  return false;
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

/** Strip Bet365 line/market suffixes from player labels ("Haaland 2", "Magalhaes Booked"). */
function stripBet365PlayerLabel(name: string): string {
  return name
    .replace(/\s+\d+$/, "")
    .replace(/\s+(booked|sent off|1st card)$/i, "")
    .trim();
}

export function normPlayer(name: string): string {
  return stripBet365PlayerLabel(
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Parse decimal or UK fractional odds (e.g. "2/9" → 1.222). */
function parseDecimal(value: unknown): number | undefined {
  if (typeof value === "number" && value > 1) return value;
  if (typeof value === "string") {
    const s = value.trim();
    const n = Number(s);
    if (Number.isFinite(n) && n > 1) return n;
    const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) {
      const num = Number(frac[1]);
      const den = Number(frac[2]);
      if (num >= 0 && den > 0) return 1 + num / den;
    }
  }
  return undefined;
}

function normalizeMarketName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function isExcludedPropText(text: string): boolean {
  const t = normalizeMarketName(text);
  return EXCLUDED_PROP_FRAGMENTS.some((frag) => t.includes(frag));
}

/** Only Bet Builder-equivalent markets — not specialty sub-lines from the API feed. */
function categoryFromCanonicalMarket(marketName: string): LegCategory | null {
  if (!marketName || isExcludedPropText(marketName)) return null;
  const key = normalizeMarketName(marketName);
  if (CANONICAL_MARKET_CATEGORY[key]) return CANONICAL_MARKET_CATEGORY[key];

  // API often nests props under "Player Props" with the real market in row.name
  for (const [canonical, cat] of Object.entries(CANONICAL_MARKET_CATEGORY)) {
    if (key === canonical) return cat;
    if (key.startsWith(`${canonical} `) && !isExcludedPropText(key)) return cat;
  }
  return null;
}

function categoryForSelection(
  marketName: string,
  rowName: string,
  label: string
): LegCategory | null {
  return (
    categoryFromCanonicalMarket(marketName) ??
    categoryFromCanonicalMarket(rowName) ??
    categoryFromCanonicalMarket(label)
  );
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
      return stripBet365PlayerLabel(dashSplit[0]!.trim());
    }
  }
  const raw = label.trim() || combined.replace(/\s[-–—]\s.*$/, "").trim();
  return stripBet365PlayerLabel(raw);
}

function isOnePlusLine(label: string, rowName?: string, hdp?: number): boolean {
  const text = `${label} ${rowName ?? ""}`.toLowerCase();
  if (/\b(2|3|4|5)\+\s/.test(text) || /\b(2|3|4|5)\+\s*(shots|sot|tackle|foul)/i.test(text))
    return false;
  if (/\bover\s*[2-9]|under\s*[0-9]/i.test(text)) return false;
  if (hdp !== undefined && Number.isFinite(hdp) && hdp > 0.5) return false;
  return true;
}

function extractRowLink(row: any): string | undefined {
  for (const key of ["link", "url", "href", "deepLink", "deep_link", "betLink"]) {
    const value = row?.[key];
    if (typeof value === "string" && value.startsWith("http")) return value;
  }
  return undefined;
}

function extractSelectionId(row: any, apiEventId?: number): string | undefined {
  for (const key of ["selectionId", "selection_id", "sid", "fid", "bs"]) {
    const value = row?.[key];
    if (typeof value === "string" && /^\d+-\d+$/.test(value)) return value;
  }

  const eventId = row?.eventId ?? row?.event_id ?? apiEventId;
  const marketId = row?.marketId ?? row?.market_id ?? row?.mid ?? row?.oid;
  if (eventId != null && marketId != null) {
    return `${eventId}-${marketId}`;
  }

  const id = row?.id;
  if (typeof id === "string" && /^\d+-\d+$/.test(id)) return id;
  if (typeof id === "number" && apiEventId != null) return `${apiEventId}-${id}`;

  return undefined;
}

function extractEventUrl(data: any): string | undefined {
  const urls = data?.urls;
  if (urls && typeof urls === "object") {
    const direct = urls.Bet365 ?? urls.bet365;
    if (typeof direct === "string" && direct.startsWith("http")) return direct;
  }
  return undefined;
}

function storeLiveQuote(
  out: Bet365LiveMap,
  matchId: number,
  playerName: string,
  category: LegCategory,
  decimal: number,
  meta: { hdp?: number; link?: string; selectionId?: string } = {}
): void {
  if (!playerName) return;
  const key = liveOddsLookupKey(matchId, playerName, category);
  const existing = out.get(key);
  const rounded = Math.round(decimal * 1000) / 1000;
  const { hdp, link, selectionId } = meta;

  if (existing !== undefined && hdp !== undefined && hdp > 0.5) return;
  if (existing !== undefined && rounded >= existing.price) return;

  out.set(key, {
    price: rounded,
    link: link ?? existing?.link,
    selectionId: selectionId ?? existing?.selectionId,
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const API_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url: URL, attempt = 0): Promise<any | null> {
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 429) {
    console.warn(
      "  bet365 live: odds-api.io rate limit (429) — requests may be dropped on free tier"
    );
    if (attempt < 1) {
      await sleep(2500);
      return fetchJson(url, attempt + 1);
    }
    return null;
  }

  if (!res.ok) {
    console.warn(`  bet365 live: odds-api.io ${res.status} for ${url.pathname}`);
    return null;
  }

  return res.json();
}

function teamsMatch(home: string, away: string, ev: any): boolean {
  const eh = normTeam(String(ev.home ?? ""));
  const ea = normTeam(String(ev.away ?? ""));
  const h = normTeam(home);
  const a = normTeam(away);
  return (eh === h && ea === a) || (eh === a && ea === h);
}

/** Map FotMob fixtures → odds-api.io event IDs (one league /events call only). */
async function resolveOddsApiEvents(
  key: string,
  fixtures: FixtureRef[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>();

  const leagueUrl = new URL("https://api.odds-api.io/v3/events");
  leagueUrl.searchParams.set("apiKey", key);
  leagueUrl.searchParams.set("sport", "football");
  leagueUrl.searchParams.set("league", WC_LEAGUE);
  leagueUrl.searchParams.set("bookmaker", "Bet365");
  leagueUrl.searchParams.set("status", "pending");
  leagueUrl.searchParams.set("limit", "500");

  const leagueEvents = await fetchJson(leagueUrl);
  if (!Array.isArray(leagueEvents)) return out;

  for (const fx of fixtures) {
    const hit = leagueEvents.find((ev) => teamsMatch(fx.home, fx.away, ev));
    if (hit?.id) out.set(fx.id, Number(hit.id));
  }

  const unmatched = fixtures.filter((fx) => !out.has(fx.id));
  if (unmatched.length) {
    console.warn(
      `  bet365 live: ${unmatched.length} fixture(s) not in odds-api.io league list:`,
      unmatched.map((fx) => `${fx.home} v ${fx.away}`).join(", ")
    );
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

/** Optional live Bet365 player props via odds-api.io (set ODDS_API_IO_KEY in CI). */
export async function fetchBet365LiveOdds(
  fixtures: FixtureRef[]
): Promise<Bet365LiveBundle> {
  const key = process.env.ODDS_API_IO_KEY;
  const empty: Bet365LiveBundle = { quotes: new Map(), eventUrls: new Map() };
  if (!key || fixtures.length === 0) return empty;

  const quotes: Bet365LiveMap = new Map();
  const eventUrls = new Map<number, string>();

  try {
    const eventMap = await resolveOddsApiEvents(key, fixtures);
    if (eventMap.size === 0) {
      console.warn("  bet365 live: no odds-api.io events matched for World Cup fixtures");
      return empty;
    }

    await sleep(API_DELAY_MS);

    const apiToFotmob = new Map<number, number>();
    for (const [fotmobId, apiId] of eventMap) {
      apiToFotmob.set(apiId, fotmobId);
    }

    const apiIds = [...eventMap.values()];
    for (let i = 0; i < apiIds.length; i += 10) {
      if (i > 0) await sleep(API_DELAY_MS);
      const batch = apiIds.slice(i, i + 10);
      const responses = await fetchOddsMulti(key, batch);
      for (const data of responses) {
        const apiEventId = Number(data?.id ?? data?.eventId);
        const fotmobId =
          apiToFotmob.get(apiEventId) ??
          [...eventMap.entries()].find(([, apiId]) => apiId === apiEventId)?.[0];
        if (fotmobId) {
          const eventUrl = extractEventUrl(data);
          if (eventUrl) eventUrls.set(fotmobId, eventUrl);
          parseOddsApiResponse(data, fotmobId, apiEventId, quotes);
        }
      }
    }
  } catch (e) {
    console.warn("  bet365 live fetch failed:", e);
  }

  return { quotes, eventUrls };
}

function parseOddsApiResponse(
  data: any,
  fotmobMatchId: number,
  apiEventId: number,
  out: Bet365LiveMap
): void {
  const bet365 = data?.bookmakers?.Bet365 ?? data?.bookmakers?.bet365;
  if (!Array.isArray(bet365)) return;

  let propMarkets = 0;
  for (const market of bet365) {
    if (parseOddsApiMarket(market, fotmobMatchId, apiEventId, out)) propMarkets += 1;
  }
  if (process.env.REFRESH_BET365_ODDS !== "false") {
    console.log(
      `  bet365 live: parsed ${out.size} prices from ${propMarkets} prop market(s) for match ${fotmobMatchId}`
    );
  }
}

function parseOddsApiMarket(
  market: any,
  fotmobMatchId: number,
  apiEventId: number,
  out: Bet365LiveMap
): boolean {
  const marketName = String(market?.name ?? market?.marketName ?? "");
  const rows = market?.odds ?? market?.outcomes ?? market?.selections ?? [];
  let matched = false;

  for (const row of rows as any[]) {
    const label = String(row?.label ?? row?.participant ?? "").trim();
    const rowName = String(row?.name ?? "").trim();
    if (!label && !rowName) continue;
    if (isExcludedPropText(`${label} ${rowName} ${marketName}`)) continue;

    const category = categoryForSelection(marketName, rowName, label);
    if (!category) continue;

    const player = extractPlayerName(label || rowName, rowName || undefined);
    const hdp = Number(row?.hdp ?? row?.handicap ?? row?.line);
    const hasHdp = Number.isFinite(hdp);
    const meta = {
      hdp: hasHdp ? hdp : undefined,
      link: extractRowLink(row) ?? extractRowLink(market),
      selectionId: extractSelectionId(row, apiEventId),
    };

    if (!isOnePlusLine(label, rowName, hasHdp ? hdp : undefined)) continue;

    const over = parseDecimal(row?.over);
    const yes = parseDecimal(row?.yes);
    const canonicalSource =
      categoryFromCanonicalMarket(marketName) ?? categoryFromCanonicalMarket(rowName);

    if (over && (!hasHdp || hdp <= 0.5)) {
      storeLiveQuote(out, fotmobMatchId, player, category, over, {
        ...meta,
        hdp: hasHdp ? hdp : 0.5,
      });
      matched = true;
      continue;
    }

    if (yes && category === "cards") {
      storeLiveQuote(out, fotmobMatchId, player, category, yes, meta);
      matched = true;
      continue;
    }

    if (canonicalSource) {
      const price = parseDecimal(row?.price ?? row?.odds ?? row?.decimal);
      if (price && (!hasHdp || hdp <= 0.5)) {
        storeLiveQuote(out, fotmobMatchId, player, category, price, {
          ...meta,
          hdp: hasHdp ? hdp : 0.5,
        });
        matched = true;
      }
    }
  }

  return matched;
}
