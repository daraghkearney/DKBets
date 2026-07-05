import type { BookmakerId, MarketType } from "../types";

/** One priced outcome from one bookmaker, in a provider-neutral shape. */
export interface OddsCell {
  bookmaker: BookmakerId;
  market: MarketType;
  outcomeKey: string; // home | draw | away | yes | no | over | under
  decimal: number;
}

export interface SourceMatch {
  home: string;
  away: string;
  kickoff: string; // ISO UTC
  odds: OddsCell[];
}

export interface SourceResult {
  id: string;
  label: string;
  matches: SourceMatch[];
  error?: string;
}

export const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

export async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: FETCH_HEADERS,
    });
  } finally {
    clearTimeout(timer);
  }
}

export function fractionalToDecimal(num: number, den: number): number {
  if (den === 0) return NaN;
  return Math.round((1 + num / den) * 1000) / 1000;
}

/** Parses "31/20", "2.55" or "EVS" into decimal odds. */
export function parseOddsString(s: string): number | null {
  const t = s.trim().toUpperCase();
  if (t === "EVS" || t === "EVENS") return 2;
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return fractionalToDecimal(Number(frac[1]), Number(frac[2]));
  const dec = Number(t);
  if (Number.isFinite(dec) && dec > 1) return dec;
  return null;
}
