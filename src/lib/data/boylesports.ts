import { fetchWithTimeout, fractionalToDecimal, type SourceMatch, type SourceResult } from "./sources";
import type { MarketType } from "../types";

/**
 * BoyleSports publishes its sportsbook as static JSON feeds on
 * cache.boylesports.com (the same feed its site consumes). INTFOOTBALL
 * carries "International - World Cup" fixtures with every market priced
 * as fractional currentpriceup/currentpricedown pairs.
 *
 * Feed timestamps are Irish local time with no zone marker, so +01:00 is
 * appended (IST during the tournament).
 */
const FEED_URL = "http://cache.boylesports.com/feeds/INTFOOTBALL.json";

const MARKET_NAMES: Record<string, MarketType> = {
  "Match Betting": "match_result",
  "To Qualify": "to_qualify",
  "Both Teams To Score": "btts",
  "Total Goals O/U 2.5": "over_under_2_5",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function fetchBoyleSports(): Promise<SourceResult> {
  const result: SourceResult = {
    id: "boylesports",
    label: "BoyleSports official feed",
    matches: [],
  };
  try {
    const res = await fetchWithTimeout(FEED_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    for (const ev of data.events ?? []) {
      if (!/world cup/i.test(ev.complayer ?? "")) continue;
      if (!/\sv\s/.test(ev.name ?? "")) continue;
      const [home, away] = ev.name.split(/\sv\s/).map((s: string) => s.trim());

      const match: SourceMatch = {
        home,
        away,
        kickoff: new Date(`${ev.tsstart}+01:00`).toISOString(),
        odds: [],
      };

      for (const market of ev.markets ?? []) {
        const type = MARKET_NAMES[market.name];
        if (!type) continue;
        for (const sel of market.selections ?? []) {
          if (sel.idfobolifestate === "S") continue; // suspended
          const dec = fractionalToDecimal(
            Number(sel.currentpriceup),
            Number(sel.currentpricedown)
          );
          if (!Number.isFinite(dec) || dec <= 1) continue;
          const key = outcomeKey(type, sel.name, home, away);
          if (!key) continue;
          match.odds.push({
            bookmaker: "boylesports",
            market: type,
            outcomeKey: key,
            decimal: dec,
          });
        }
      }
      if (match.odds.length > 0) result.matches.push(match);
    }
    if (result.matches.length === 0) result.error = "no World Cup fixtures";
  } catch (e) {
    result.error = e instanceof Error ? e.message : "fetch failed";
  }
  return result;
}

function outcomeKey(
  type: MarketType,
  selection: string,
  home: string,
  away: string
): string | null {
  const s = selection.trim().toLowerCase();
  switch (type) {
    case "match_result":
    case "to_qualify":
      if (s === home.toLowerCase()) return "home";
      if (s === away.toLowerCase()) return "away";
      if (s === "draw") return type === "match_result" ? "draw" : null;
      return null;
    case "btts":
      return s === "yes" || s === "no" ? s : null;
    case "over_under_2_5":
      if (s.startsWith("over")) return "over";
      if (s.startsWith("under")) return "under";
      return null;
  }
}
