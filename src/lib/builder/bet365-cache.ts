import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Bet365LiveMap, Bet365LiveQuote } from "./bet365-live";
import { PRIMARY_FOOTBALL_COMPETITION_ID } from "@/lib/sports/football";

/** Fresh cache for routine push deploys (hourly refresh keeps this valid). */
const CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** Bump when parser logic changes — invalidates stale wrong-price caches. */
export const BET365_CACHE_VERSION = 8;

function cacheFileForCompetition(competitionId?: string): string {
  let id = competitionId;
  if (!id) {
    try {
      // Lazy — store may set active competition during export
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getActiveFootballCompetitionId } = require("@/lib/stats/store") as typeof import("@/lib/stats/store");
      id = getActiveFootballCompetitionId();
    } catch {
      id = PRIMARY_FOOTBALL_COMPETITION_ID;
    }
  }
  if (id === PRIMARY_FOOTBALL_COMPETITION_ID) {
    return path.join(process.cwd(), ".cache", "bet365-live-odds.json");
  }
  return path.join(process.cwd(), ".cache", `bet365-live-odds-${id}.json`);
}

interface Bet365OddsCache {
  version: number;
  savedAt: string;
  prices: [string, Bet365LiveQuote | number][];
  eventUrls?: [string, string][];
}

function normalizeQuote(raw: Bet365LiveQuote | number): Bet365LiveQuote {
  if (typeof raw === "number") return { price: raw };
  return raw;
}

export function shouldRefreshBet365Odds(): boolean {
  return process.env.REFRESH_BET365_ODDS !== "false";
}

export async function loadCachedBet365Odds(
  options: { ignoreAge?: boolean } = {}
): Promise<Bet365LiveMap | null> {
  try {
    const raw = await readFile(cacheFileForCompetition(), "utf8");
    const data = JSON.parse(raw) as Bet365OddsCache;
    if (data.version !== BET365_CACHE_VERSION) {
      console.warn(
        `  bet365 live: cache version mismatch (got v${data.version}, want v${BET365_CACHE_VERSION})`
      );
      return null;
    }
    if (
      !options.ignoreAge &&
      Date.now() - new Date(data.savedAt).getTime() > CACHE_MAX_AGE_MS
    ) {
      console.warn("  bet365 live: cached prices expired");
      return null;
    }
    if (!data.prices?.length) return null;
    return new Map(
      data.prices.map(([key, value]) => [key, normalizeQuote(value)])
    );
  } catch {
    return null;
  }
}

export async function loadCachedBet365EventUrls(): Promise<Map<number, string>> {
  try {
    const raw = await readFile(cacheFileForCompetition(), "utf8");
    const data = JSON.parse(raw) as Bet365OddsCache;
    if (data.version !== BET365_CACHE_VERSION || !data.eventUrls?.length) {
      return new Map();
    }
    return new Map(
      data.eventUrls.map(([id, url]) => [Number(id), url] as [number, string])
    );
  } catch {
    return new Map();
  }
}

export async function saveCachedBet365Odds(
  map: Bet365LiveMap,
  eventUrls: Map<number, string> = new Map()
): Promise<void> {
  if (map.size === 0) return;
  const file = cacheFileForCompetition();
  await mkdir(path.dirname(file), { recursive: true });
  const payload: Bet365OddsCache = {
    version: BET365_CACHE_VERSION,
    savedAt: new Date().toISOString(),
    prices: [...map.entries()],
    eventUrls: [...eventUrls.entries()].map(([id, url]) => [String(id), url]),
  };
  await writeFile(file, JSON.stringify(payload), "utf8");
  console.log(`  bet365 live: cached ${map.size} prices for reuse on push deploys`);
}
