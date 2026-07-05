import { ODDSSCANNER_NAME_MAP } from "../bookmakers";
import { fetchWithTimeout, parseOddsString, type SourceMatch, type SourceResult } from "./sources";

/**
 * Oddsscanner (oddsscanner.com) server-renders a full multi-bookmaker
 * comparison table (Money Line - Full Time) on each match page, covering
 * Bet365 plus nine other UK books that block direct access. The World Cup
 * hub page lists the match URLs.
 *
 * Only the match-result market is server-rendered (other markets hydrate
 * client-side), so this source contributes 1X2 prices only.
 */
const HUB_URL = "https://oddsscanner.com/football/world-cup";

export async function fetchOddsscanner(): Promise<SourceResult> {
  const result: SourceResult = {
    id: "oddsscanner",
    label: "Oddsscanner (Bet365 + 9 books)",
    matches: [],
  };
  try {
    const hub = await fetchWithTimeout(HUB_URL, 10_000);
    if (!hub.ok) throw new Error(`HTTP ${hub.status}`);
    const hubHtml = await hub.text();

    const links = [
      ...new Set(
        [...hubHtml.matchAll(
          /href="(https:\/\/oddsscanner\.com\/football\/[a-z0-9-]+-vs-[a-z0-9-]+)"/g
        )].map((m) => m[1])
      ),
    ].slice(0, 12);

    const pages = await Promise.allSettled(
      links.map(async (url) => {
        const res = await fetchWithTimeout(url, 10_000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseMatchPage(await res.text());
      })
    );

    for (const page of pages) {
      if (page.status === "fulfilled" && page.value) {
        result.matches.push(page.value);
      }
    }
    if (result.matches.length === 0) result.error = "no parseable match pages";
  } catch (e) {
    result.error = e instanceof Error ? e.message : "fetch failed";
  }
  return result;
}

function parseMatchPage(html: string): SourceMatch | null {
  const title = html.match(/<title>([^<»]+?)\s+vs\s+([^<»]+?)\s*»/);
  if (!title) return null;
  const home = title[1].trim();
  const away = title[2].trim();

  const kickoff = html.match(/"startDate":"([^"]+)"/)?.[1];
  if (!kickoff) return null;

  // The server-rendered comparison table lives after the "Operador" header:
  // rows of <div class="operator_name">NAME</div> ... then three
  // <div class="odd_value">...</a>PRICE</div> cells (1 / X / 2).
  const tableStart = html.indexOf("Operador");
  if (tableStart < 0) return null;
  const table = html.slice(tableStart);

  const match: SourceMatch = {
    home,
    away,
    kickoff: new Date(kickoff).toISOString(),
    odds: [],
  };

  // Slice the table into per-bookmaker segments (name → next name), then
  // pull the three 1/X/2 prices out of each segment.
  const nameRe = /class="operator_name">([^<]+)<\/div>/g;
  const cellRe = /<\/a>([0-9./]+|EVS)<\/div>/gi;
  const rows: Array<{ name: string; start: number; end: number }> = [];
  for (const m of table.matchAll(nameRe)) {
    if (rows.length > 0) rows[rows.length - 1].end = m.index!;
    rows.push({ name: m[1].trim(), start: m.index!, end: table.length });
  }

  for (const row of rows) {
    const bookie = ODDSSCANNER_NAME_MAP[row.name];
    if (!bookie) continue;
    const segment = table.slice(row.start, row.end);
    const prices = [...segment.matchAll(cellRe)]
      .map((c) => parseOddsString(c[1]))
      .slice(0, 3);
    if (prices.length !== 3 || prices.some((p) => p == null)) continue;
    const [h, x, a] = prices as number[];
    match.odds.push(
      { bookmaker: bookie, market: "match_result", outcomeKey: "home", decimal: h },
      { bookmaker: bookie, market: "match_result", outcomeKey: "draw", decimal: x },
      { bookmaker: bookie, market: "match_result", outcomeKey: "away", decimal: a }
    );
  }

  return match.odds.length > 0 ? match : null;
}
