/**
 * FotMob open-API client with in-memory caching + request de-duplication.
 * World Cup league id = 77.
 */

import { gunzipSync } from "zlib";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const WC_LEAGUE_ID = 77;

interface CacheEntry {
  expires: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<unknown>>();

/** Drop cached FotMob payloads (use between heavy export passes). */
export function clearFotmobCache(): void {
  cache.clear();
  pending.clear();
}

async function fetchJson(url: string, ttlMs: number): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data;
  const inFlight = pending.get(url);
  if (inFlight) return inFlight;

  const p = (async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`FotMob ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    let text: string;
    // data.fotmob.com serves raw gzip bodies without a Content-Encoding header
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      text = gunzipSync(buf).toString("utf8");
    } else {
      text = buf.toString("utf8");
    }
    const data = JSON.parse(text);
    cache.set(url, { expires: Date.now() + ttlMs, data });
    return data;
  })();

  pending.set(url, p);
  try {
    return await p;
  } finally {
    pending.delete(url);
  }
}

/** Run tasks with bounded concurrency. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await fn(items[i]);
      } catch {
        results[i] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Raw endpoint wrappers (loosely typed — the engine narrows them)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Full league payload: fixtures, leaderboards, details. */
export function getLeague(): Promise<any> {
  return fetchJson(
    `https://www.fotmob.com/api/data/leagues?id=${WC_LEAGUE_ID}&tab=matches&type=league&timeZone=UTC`,
    10 * 60_000
  );
}

/** Match details: lineups, per-player match stats, events, h2h. */
export function getMatchDetails(matchId: number, finished: boolean): Promise<any> {
  // Finished matches are immutable — cache for a day. Upcoming: lineups can flip
  // from predicted to confirmed, so keep it fresh.
  const ttl = finished ? 24 * 60 * 60_000 : 3 * 60_000;
  return fetchJson(`https://www.fotmob.com/api/data/matchDetails?matchId=${matchId}`, ttl);
}

/** Player profile incl. recentMatches (last ~45 club + international games). */
export function getPlayerData(playerId: number): Promise<any> {
  return fetchJson(`https://www.fotmob.com/api/data/playerData?id=${playerId}`, 6 * 60 * 60_000);
}

/** Full leaderboard list for a stat (e.g. "fouls.json"). */
export function getLeaderboard(seasonId: string | number, statFile: string): Promise<any> {
  return fetchJson(
    `https://data.fotmob.com/stats/${WC_LEAGUE_ID}/season/${seasonId}/${statFile}`,
    30 * 60_000
  );
}
