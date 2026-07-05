import type { OddsCell } from "./sources";
import { fetchWithTimeout, type SourceMatch, type SourceResult } from "./sources";

/**
 * Coral publishes its full sportsbook through an open OpenBet "site server"
 * JSON API (the same feed its own web app uses). Class 115 is Football
 * International; typeName "World Cup 2026" carries the tournament fixtures.
 *
 * The slash in the "Total Goals Over/Under" template breaks their filter
 * parser, so the 2.5-goals market is pulled with a second request filtered
 * by dispSortName=HL + rawHandicapValue=2.5 instead.
 */
const BASE =
  "https://ss-aka-ori.coral.co.uk/openbet-ssviewer/Drilldown/2.31/EventToOutcomeForClass/115";

const MAIN_URL =
  `${BASE}?simpleFilter=event.isStarted:isFalse` +
  `&simpleFilter=market.templateMarketName:intersects:%7CMatch%20Betting%7C,%7CBoth%20Teams%20to%20Score%7C,%7CTo%20Qualify%7C` +
  `&translationLang=en&responseFormat=json`;

const OU_URL =
  `${BASE}?simpleFilter=event.isStarted:isFalse` +
  `&simpleFilter=market.dispSortName:equals:HL` +
  `&simpleFilter=market.rawHandicapValue:equals:2.5` +
  `&translationLang=en&responseFormat=json`;

/* eslint-disable @typescript-eslint/no-explicit-any */

function eventsOf(payload: any): any[] {
  return (payload?.SSResponse?.children ?? [])
    .filter((c: any) => c.event)
    .map((c: any) => c.event);
}

function priceOf(outcome: any): number | null {
  const price = (outcome.children ?? []).find((c: any) => c.price)?.price;
  const dec = Number(price?.priceDec);
  return Number.isFinite(dec) && dec > 1 ? dec : null;
}

export async function fetchCoral(): Promise<SourceResult> {
  const result: SourceResult = {
    id: "coral",
    label: "Coral official feed",
    matches: [],
  };
  try {
    const [mainRes, ouRes] = await Promise.all([
      fetchWithTimeout(MAIN_URL),
      fetchWithTimeout(OU_URL),
    ]);
    if (!mainRes.ok) throw new Error(`HTTP ${mainRes.status}`);

    const byName = new Map<string, SourceMatch>();

    for (const ev of eventsOf(await mainRes.json())) {
      if (ev.typeName !== "World Cup 2026" || !/\sv\s/.test(ev.name)) continue;
      const [home, away] = ev.name.split(/\sv\s/).map((s: string) => s.trim());
      const match: SourceMatch = {
        home,
        away,
        kickoff: new Date(ev.startTime).toISOString(),
        odds: [],
      };

      for (const c of ev.children ?? []) {
        const market = c.market;
        if (!market) continue;
        const tpl = market.templateMarketName;
        for (const oc of market.children ?? []) {
          const outcome = oc.outcome;
          if (!outcome) continue;
          const dec = priceOf(outcome);
          if (dec == null) continue;
          const cell = mapMainOutcome(tpl, outcome);
          if (cell) match.odds.push({ ...cell, decimal: dec });
        }
      }
      if (match.odds.length > 0) byName.set(ev.name, match);
    }

    if (ouRes.ok) {
      for (const ev of eventsOf(await ouRes.json())) {
        const match = byName.get(ev.name);
        if (!match) continue;
        for (const c of ev.children ?? []) {
          const market = c.market;
          // HL filter also returns half-time totals; keep the match total only
          if (!market || market.name !== "Over/Under Total Goals 2.5") continue;
          for (const oc of market.children ?? []) {
            const outcome = oc.outcome;
            if (!outcome) continue;
            const dec = priceOf(outcome);
            if (dec == null) continue;
            const key = outcome.name.toLowerCase();
            if (key === "over" || key === "under") {
              match.odds.push({
                bookmaker: "coral",
                market: "over_under_2_5",
                outcomeKey: key,
                decimal: dec,
              });
            }
          }
        }
      }
    }

    result.matches = [...byName.values()];
    if (result.matches.length === 0) result.error = "no World Cup fixtures";
  } catch (e) {
    result.error = e instanceof Error ? e.message : "fetch failed";
  }
  return result;
}

function mapMainOutcome(
  tpl: string,
  outcome: any
): Omit<OddsCell, "decimal"> | null {
  const minor = outcome.outcomeMeaningMinorCode;
  if (tpl === "Match Betting") {
    const key = minor === "H" ? "home" : minor === "A" ? "away" : minor === "D" ? "draw" : null;
    return key ? { bookmaker: "coral", market: "match_result", outcomeKey: key } : null;
  }
  if (tpl === "To Qualify") {
    const key = minor === "H" ? "home" : minor === "A" ? "away" : null;
    return key ? { bookmaker: "coral", market: "to_qualify", outcomeKey: key } : null;
  }
  if (tpl === "Both Teams to Score") {
    const key = outcome.name.toLowerCase();
    return key === "yes" || key === "no"
      ? { bookmaker: "coral", market: "btts", outcomeKey: key }
      : null;
  }
  return null;
}
