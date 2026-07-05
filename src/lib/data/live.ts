import type {
  Market,
  MarketType,
  Match,
  OddsSnapshot,
  SourceStatus,
} from "../types";
import { fetchBoyleSports } from "./boylesports";
import { fetchCoral } from "./coral";
import { flagFor } from "./flags";
import { fetchOddsscanner } from "./oddsscanner";
import type { SourceMatch, SourceResult } from "./sources";

/**
 * Merges every live source into one snapshot. Fixtures are matched across
 * sources by normalised team names (handling home/away order differences),
 * so each market row ends up with one column per bookmaker.
 *
 * Each source is cached independently: bookmaker feeds re-fetch every 15s,
 * the heavier Oddsscanner page scrape every 60s. A failed refresh keeps
 * serving the previous good data rather than dropping a bookmaker.
 */

interface CacheEntry {
  fetchedAt: number;
  result: SourceResult;
}

const cache = new Map<string, CacheEntry>();

async function cached(
  id: string,
  ttlMs: number,
  fetcher: () => Promise<SourceResult>
): Promise<SourceResult> {
  const entry = cache.get(id);
  if (entry && Date.now() - entry.fetchedAt < ttlMs) return entry.result;

  const result = await fetcher();
  if (result.matches.length > 0 || !entry) {
    cache.set(id, { fetchedAt: Date.now(), result });
    return result;
  }
  // Refresh failed — keep stale data but bump the timestamp slightly so we
  // retry soon without hammering a broken endpoint on every poll.
  entry.fetchedAt = Date.now() - ttlMs + 5000;
  return entry.result;
}

const MARKET_META: Array<{ type: MarketType; name: string; outcomes: string[] }> = [
  { type: "match_result", name: "Match Result (90 mins)", outcomes: ["home", "draw", "away"] },
  { type: "to_qualify", name: "To Qualify", outcomes: ["home", "away"] },
  { type: "btts", name: "Both Teams To Score", outcomes: ["yes", "no"] },
  { type: "over_under_2_5", name: "Over / Under 2.5 Goals", outcomes: ["over", "under"] },
];

function norm(team: string): string {
  const t = team.trim().toLowerCase().replace(/\./g, "");
  if (t === "united states") return "usa";
  return t;
}

function stageFor(date: Date): string {
  if (date.getUTCFullYear() !== 2026) return "World Cup 2026";
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  if (m === 5) return d < 28 ? "Group Stage" : "Round of 32";
  if (m === 6) {
    if (d <= 3) return "Round of 32";
    if (d <= 8) return "Round of 16";
    if (d <= 12) return "Quarter-Final";
    if (d <= 16) return "Semi-Final";
    if (d <= 18) return "Third-Place Play-off";
    return "Final";
  }
  return "World Cup 2026";
}

export async function buildLiveSnapshot(): Promise<OddsSnapshot | null> {
  const [coral, boyle, scanner] = await Promise.all([
    cached("coral", 15_000, fetchCoral),
    cached("boylesports", 15_000, fetchBoyleSports),
    cached("oddsscanner", 60_000, fetchOddsscanner),
  ]);

  const sources: SourceStatus[] = [coral, boyle, scanner].map((s) => ({
    id: s.id,
    label: s.label,
    ok: s.matches.length > 0,
    detail:
      s.matches.length > 0
        ? `${s.matches.length} fixtures`
        : (s.error ?? "no data"),
  }));

  // Canonical fixture registry, keyed by normalised team pair
  const fixtures = new Map<
    string,
    { home: string; away: string; kickoff: string; cells: SourceMatch["odds"] }
  >();

  const ingest = (source: SourceMatch) => {
    const key = `${norm(source.home)}|${norm(source.away)}`;
    const reversedKey = `${norm(source.away)}|${norm(source.home)}`;

    if (fixtures.has(key)) {
      fixtures.get(key)!.cells.push(...source.odds);
      return;
    }
    if (fixtures.has(reversedKey)) {
      // Source disagrees on home/away order — flip directional outcomes
      const flipped = source.odds.map((cell) => ({
        ...cell,
        outcomeKey:
          cell.outcomeKey === "home"
            ? "away"
            : cell.outcomeKey === "away"
              ? "home"
              : cell.outcomeKey,
      }));
      fixtures.get(reversedKey)!.cells.push(...flipped);
      return;
    }
    fixtures.set(key, {
      home: source.home,
      away: source.away,
      kickoff: source.kickoff,
      cells: [...source.odds],
    });
  };

  // Coral first: its kickoffs are proper UTC and it names fixtures cleanly
  for (const m of coral.matches) ingest(m);
  for (const m of boyle.matches) ingest(m);
  for (const m of scanner.matches) ingest(m);

  const now = Date.now();
  const matches: Match[] = [];

  for (const fx of fixtures.values()) {
    const kickoffMs = new Date(fx.kickoff).getTime();
    if (kickoffMs < now) continue; // already kicked off

    const markets: Market[] = [];
    for (const meta of MARKET_META) {
      const cells = fx.cells.filter((c) => c.market === meta.type);
      if (cells.length === 0) continue;

      const market: Market = {
        id: meta.type,
        type: meta.type,
        name: meta.name,
        outcomes: meta.outcomes.map((key) => ({
          key,
          label: labelFor(meta.type, key, fx.home, fx.away),
          odds: {},
        })),
      };
      for (const cell of cells) {
        const outcome = market.outcomes.find((o) => o.key === cell.outcomeKey);
        if (outcome) outcome.odds[cell.bookmaker] = cell.decimal;
      }
      // Drop markets where any outcome is completely unpriced (no arb math possible)
      if (market.outcomes.every((o) => Object.keys(o.odds).length > 0)) {
        markets.push(market);
      }
    }

    if (markets.length === 0) continue;
    const kickoffDate = new Date(fx.kickoff);
    matches.push({
      id: `${norm(fx.home)}-${norm(fx.away)}`,
      kickoff: fx.kickoff,
      stage: stageFor(kickoffDate),
      home: fx.home,
      away: fx.away,
      homeFlag: flagFor(fx.home),
      awayFlag: flagFor(fx.away),
      markets,
    });
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  return {
    generatedAt: new Date().toISOString(),
    source: "live",
    sourceLabel: "Live bookmaker feeds",
    sources,
    matches,
  };
}

function labelFor(
  type: MarketType,
  key: string,
  home: string,
  away: string
): string {
  switch (key) {
    case "home":
      return home;
    case "away":
      return away;
    case "draw":
      return "Draw";
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "over":
      return "Over 2.5";
    case "under":
      return "Under 2.5";
    default:
      return key;
  }
}
