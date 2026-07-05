import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), ".cache", "bet365-live-odds.json");
/** Slightly under hourly refresh so push deploys can reuse cached prices. */
const CACHE_MAX_AGE_MS = 75 * 60 * 1000;

interface Bet365OddsCache {
  savedAt: string;
  prices: [string, number][];
}

export function shouldRefreshBet365Odds(): boolean {
  return process.env.REFRESH_BET365_ODDS !== "false";
}

export async function loadCachedBet365Odds(
  allowStale = false
): Promise<Map<string, number> | null> {
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const data = JSON.parse(raw) as Bet365OddsCache;
    if (!allowStale && Date.now() - new Date(data.savedAt).getTime() > CACHE_MAX_AGE_MS) {
      console.warn("  bet365 live: cached prices expired");
      return null;
    }
    if (!data.prices?.length) return null;
    return new Map(data.prices);
  } catch {
    return null;
  }
}

export async function saveCachedBet365Odds(map: Map<string, number>): Promise<void> {
  if (map.size === 0) return;
  await mkdir(path.dirname(CACHE_FILE), { recursive: true });
  const payload: Bet365OddsCache = {
    savedAt: new Date().toISOString(),
    prices: [...map.entries()],
  };
  await writeFile(CACHE_FILE, JSON.stringify(payload), "utf8");
  console.log(`  bet365 live: cached ${map.size} prices for reuse on push deploys`);
}
