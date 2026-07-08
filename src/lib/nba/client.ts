/**
 * NBA.com Stats API client — FotMob-equivalent for basketball.
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

export type NbaPropCategory = "pts" | "reb" | "ast" | "fg3m" | "stl" | "blk";

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

export interface NbaPropRate {
  category: NbaPropCategory;
  label: string;
  threshold: number;
  hits: number;
  sample: number;
  hitRate: number;
}

export interface NbaPlayerProps {
  playerId: number;
  name: string;
  team: string;
  rates: NbaPropRate[];
}

export interface NbaScoreboardGame {
  gameId: string;
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
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
  playerProps: NbaPlayerProps[];
}

interface NbaResultSet {
  name?: string;
  headers: string[];
  rowSet: unknown[][];
}

interface NbaApiResponse {
  resultSets?: NbaResultSet[];
  resultSet?: NbaResultSet;
}

const PROP_DEFS: Array<{
  category: NbaPropCategory;
  label: string;
  threshold: number;
  field: string;
}> = [
  { category: "pts", label: "20+ points", threshold: 20, field: "PTS" },
  { category: "pts", label: "25+ points", threshold: 25, field: "PTS" },
  { category: "reb", label: "8+ rebounds", threshold: 8, field: "REB" },
  { category: "ast", label: "6+ assists", threshold: 6, field: "AST" },
  { category: "fg3m", label: "3+ threes", threshold: 3, field: "FG3M" },
];

function currentSeason(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = m >= 9 ? y : y - 1;
  const end = (start + 1) % 100;
  return `${start}-${String(end).padStart(2, "0")}`;
}

function fallbackSeason(): string {
  const s = currentSeason();
  const [start] = s.split("-").map(Number);
  return `${start - 1}-${String(start % 100).padStart(2, "0")}`;
}

async function nbaFetch(path: string, ttlMs = 60_000): Promise<NbaApiResponse> {
  const url = `https://stats.nba.com/stats/${path}`;
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data as NbaApiResponse;

  const res = await fetch(url, {
    headers: NBA_HEADERS,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`NBA ${res.status} for ${path}`);
  const data = (await res.json()) as NbaApiResponse;
  cache.set(url, { expires: Date.now() + ttlMs, data });
  return data;
}

function getResultSets(data: NbaApiResponse): NbaResultSet[] {
  if (data.resultSets?.length) return data.resultSets;
  if (data.resultSet) return [data.resultSet];
  return [];
}

function rows(data: NbaApiResponse, index = 0): Record<string, unknown>[] {
  const rs = getResultSets(data)[index];
  if (!rs) return [];
  return rs.rowSet.map((row) => {
    const obj: Record<string, unknown> = {};
    rs.headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

function rowsNamed(data: NbaApiResponse, name: string): Record<string, unknown>[] {
  const rs = getResultSets(data).find((r) => r.name === name);
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

  let data: NbaApiResponse;
  try {
    data = await nbaFetch(`leagueleaders?${q}`, 300_000);
  } catch {
    q.set("Season", fallbackSeason());
    data = await nbaFetch(`leagueleaders?${q}`, 300_000);
  }

  return rows(data, 0)
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

export async function fetchNbaScoreboard(
  date = new Date().toISOString().slice(0, 10)
): Promise<NbaScoreboardGame[]> {
  const q = new URLSearchParams({ GameDate: date, LeagueID: "00" });
  const data = await nbaFetch(`scoreboardv2?${q}`, 120_000);

  const headers = rowsNamed(data, "GameHeader");
  const lines = rowsNamed(data, "LineScore");
  const byGame = new Map<string, NbaScoreboardGame>();

  for (const g of headers) {
    const gameId = String(g.GAME_ID ?? "");
    byGame.set(gameId, {
      gameId,
      home: "",
      away: "",
      homeAbbr: "",
      awayAbbr: "",
      homeScore: null,
      awayScore: null,
      status: String(g.GAME_STATUS_TEXT ?? "Scheduled"),
      gameDate: String(g.GAME_DATE_EST ?? "").slice(0, 10),
    });
  }

  for (const line of lines) {
    const gameId = String(line.GAME_ID ?? "");
    const entry = byGame.get(gameId);
    if (!entry) continue;
    const homeId = headers.find((h) => String(h.GAME_ID) === gameId)?.HOME_TEAM_ID;
    const teamId = line.TEAM_ID;
    const label = `${line.TEAM_CITY_NAME} ${line.TEAM_NAME}`.trim();
    const abbr = String(line.TEAM_ABBREVIATION ?? "");
    const pts = line.PTS != null ? Number(line.PTS) : null;

    if (String(teamId) === String(homeId)) {
      entry.home = label;
      entry.homeAbbr = abbr;
      entry.homeScore = pts;
    } else {
      entry.away = label;
      entry.awayAbbr = abbr;
      entry.awayScore = pts;
    }
  }

  return [...byGame.values()];
}

export async function fetchPlayerPropRates(
  playerId: number,
  name: string,
  team: string,
  season: string
): Promise<NbaPlayerProps> {
  const q = new URLSearchParams({
    PlayerID: String(playerId),
    Season: season,
    SeasonType: "Regular Season",
  });

  let gameRows: Record<string, unknown>[] = [];
  try {
    const data = await nbaFetch(`playergamelog?${q}`, 300_000);
    gameRows = rows(data, 0);
  } catch {
    /* empty */
  }

  const recent = gameRows.slice(0, 20);
  const rates: NbaPropRate[] = PROP_DEFS.map((def) => {
    const hits = recent.filter(
      (g) => Number(g[def.field] ?? 0) >= def.threshold
    ).length;
    const sample = recent.length;
    return {
      category: def.category,
      label: def.label,
      threshold: def.threshold,
      hits,
      sample,
      hitRate: sample ? hits / sample : 0,
    };
  });

  return { playerId, name, team, rates };
}

export async function buildNbaPayload(): Promise<NbaPayload> {
  let season = currentSeason();
  let leaders = await fetchNbaLeaders(season).catch(() => []);
  if (!leaders.length) {
    season = fallbackSeason();
    leaders = await fetchNbaLeaders(season).catch(() => []);
  }

  const scoreboard = await fetchNbaScoreboard().catch(() => []);

  const playerProps: NbaPlayerProps[] = [];
  for (const p of leaders.slice(0, 12)) {
    try {
      playerProps.push(
        await fetchPlayerPropRates(p.playerId, p.name, p.team, season)
      );
      await new Promise((r) => setTimeout(r, 350));
    } catch {
      /* skip player */
    }
  }

  return {
    season,
    seasonType: "Regular Season",
    source: "nba.com",
    sourceLabel: `NBA.com Stats · ${season}`,
    exportedAt: new Date().toISOString(),
    leaders,
    scoreboard,
    playerProps,
  };
}
