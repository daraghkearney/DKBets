/**
 * NBA.com Stats API client — FotMob-equivalent for basketball.
 * Uses the public stats.nba.com JSON endpoints (same as nba_api).
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const NBA_HEADERS = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

const cache = new Map<string, { expires: number; data: unknown }>();

export interface NbaPlayerLeader {
  playerId: number;
  name: string;
  team: string;
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg3m: number;
  min: number;
  fgPct: number;
  ftPct: number;
}

export interface NbaScoreboardGame {
  gameId: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  gameDate: string;
}

export interface NbaPayload {
  season: string;
  seasonType: string;
  source: "nba.com";
  sourceLabel: string;
  exportedAt: string;
  leaders: NbaPlayerLeader[];
  scoreboard: NbaScoreboardGame[];
}

function currentSeason(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  // NBA season spans Oct–Jun
  const start = m >= 9 ? y : y - 1;
  const end = (start + 1) % 100;
  return `${start}-${String(end).padStart(2, "0")}`;
}

async function nbaFetch(path: string, ttlMs = 60_000): Promise<unknown> {
  const url = `https://stats.nba.com/stats/${path}`;
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data;

  const res = await fetch(url, {
    headers: NBA_HEADERS,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`NBA ${res.status} for ${path}`);
  const data = await res.json();
  cache.set(url, { expires: Date.now() + ttlMs, data });
  return data;
}

function rowSet(data: {
  resultSets?: Array<{
    headers: string[];
    rowSet: unknown[][];
  }>;
}): Record<string, unknown>[] {
  const rs = data.resultSets?.[0];
  if (!rs) return [];
  return rs.rowSet.map((row) => {
    const obj: Record<string, unknown> = {};
    rs.headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

export async function fetchNbaLeaders(
  season = currentSeason()
): Promise<NbaPlayerLeader[]> {
  const q = new URLSearchParams({
    LeagueID: "00",
    PerMode: "PerGame",
    Scope: "S",
    Season: season,
    SeasonType: "Regular Season",
    StatCategory: "PTS",
  });
  const data = (await nbaFetch(`leagueleaders?${q}`, 300_000)) as Parameters<
    typeof rowSet
  >[0];

  return rowSet(data)
    .slice(0, 50)
    .map((r) => ({
      playerId: Number(r.PLAYER_ID),
      name: String(r.PLAYER ?? ""),
      team: String(r.TEAM ?? ""),
      gp: Number(r.GP ?? 0),
      pts: Number(r.PTS ?? 0),
      reb: Number(r.REB ?? 0),
      ast: Number(r.AST ?? 0),
      stl: Number(r.STL ?? 0),
      blk: Number(r.BLK ?? 0),
      fg3m: Number(r.FG3M ?? 0),
      min: Number(r.MIN ?? 0),
      fgPct: Number(r.FG_PCT ?? 0),
      ftPct: Number(r.FT_PCT ?? 0),
    }))
    .filter((p) => p.name && p.gp > 0);
}

export async function fetchNbaScoreboard(): Promise<NbaScoreboardGame[]> {
  const q = new URLSearchParams({
    GameDate: new Date().toISOString().slice(0, 10),
    LeagueID: "00",
  });
  const data = (await nbaFetch(`scoreboardv2?${q}`, 120_000)) as Parameters<
    typeof rowSet
  >[0];

  return rowSet(data).map((r) => ({
    gameId: String(r.GAME_ID ?? ""),
    home: String(r.HOME_TEAM_NAME ?? r.HOME_TEAM_ABBREVIATION ?? ""),
    away: String(r.VISITOR_TEAM_NAME ?? r.VISITOR_TEAM_ABBREVIATION ?? ""),
    homeScore: r.HOME_TEAM_SCORE != null ? Number(r.HOME_TEAM_SCORE) : null,
    awayScore: r.VISITOR_TEAM_SCORE != null ? Number(r.VISITOR_TEAM_SCORE) : null,
    status: String(r.GAME_STATUS_TEXT ?? r.LIVE_PERIOD != null ? "Live" : "Scheduled"),
    gameDate: String(r.GAME_DATE_EST ?? ""),
  }));
}

export async function buildNbaPayload(): Promise<NbaPayload> {
  const season = currentSeason();
  const [leaders, scoreboard] = await Promise.all([
    fetchNbaLeaders(season).catch(() => []),
    fetchNbaScoreboard().catch(() => []),
  ]);

  return {
    season,
    seasonType: "Regular Season",
    source: "nba.com",
    sourceLabel: `NBA.com Stats · ${season}`,
    exportedAt: new Date().toISOString(),
    leaders,
    scoreboard,
  };
}
