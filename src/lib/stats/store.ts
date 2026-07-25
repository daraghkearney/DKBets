import { buildStatsIndex } from "./index-build";
import { getLeague, PRIMARY_LEAGUE_ID } from "./fotmob";
import {
  parseFixtures,
  type RawFixture,
} from "./parse";
import {
  DEFAULT_SAMPLE_MODE,
  type StatsSampleMode,
} from "./sample-mode";
import type { TeamMatchLine } from "./team-lines";
import type { PlayerTournamentStats } from "./types";
import {
  PRIMARY_FOOTBALL_COMPETITION_ID,
  PRIMARY_FOOTBALL_LEAGUE_ID,
  PRIMARY_FOOTBALL_LABEL,
  PRIMARY_ODDS_API_LEAGUE,
  footballCompetition,
} from "@/lib/sports/football";

interface ModeCache {
  playerIndex: Map<number, PlayerTournamentStats>;
  teamIndex: Map<string, TeamMatchLine[]>;
  builtAt: number;
}

const INDEX_TTL = 15 * 60_000;
const cacheByKey = new Map<string, ModeCache>();
let activeSampleMode: StatsSampleMode = DEFAULT_SAMPLE_MODE;
let activeCompetitionId = PRIMARY_FOOTBALL_COMPETITION_ID;
let activeLeagueId = PRIMARY_FOOTBALL_LEAGUE_ID;
let activeOddsLeague = PRIMARY_ODDS_API_LEAGUE;
let activeCompetitionLabel = PRIMARY_FOOTBALL_LABEL;

function cacheKey(mode: StatsSampleMode): string {
  return `${activeLeagueId}:${mode}`;
}

export function setActiveSampleMode(mode: StatsSampleMode): void {
  activeSampleMode = mode;
}

export function getActiveSampleMode(): StatsSampleMode {
  return activeSampleMode;
}

/** Switch FotMob league + odds-api slug for multi-competition export/runtime. */
export function setActiveFootballCompetition(competitionId: string): void {
  const meta = footballCompetition(competitionId);
  if (!meta) {
    throw new Error(`Unknown football competition: ${competitionId}`);
  }
  activeCompetitionId = meta.id;
  activeLeagueId = meta.fotmobLeagueId;
  activeOddsLeague = meta.oddsApiLeague;
  activeCompetitionLabel = meta.label;
}

export function getActiveFootballCompetitionId(): string {
  return activeCompetitionId;
}

export function getActiveFootballLeagueId(): number {
  return activeLeagueId;
}

export function getActiveOddsApiLeague(): string {
  return activeOddsLeague;
}

export function getActiveCompetitionLabel(): string {
  return activeCompetitionLabel;
}

export function clearPlayerIndexCache(mode?: StatsSampleMode): void {
  if (mode) cacheByKey.delete(cacheKey(mode));
  else cacheByKey.clear();
}

export async function ensurePlayerIndex(
  mode: StatsSampleMode = activeSampleMode
): Promise<Map<number, PlayerTournamentStats>> {
  const key = cacheKey(mode);
  const hit = cacheByKey.get(key);
  if (hit && Date.now() - hit.builtAt < INDEX_TTL) {
    return hit.playerIndex;
  }

  const built = await buildStatsIndex(mode);
  cacheByKey.set(key, {
    playerIndex: built.playerIndex,
    teamIndex: built.teamIndex,
    builtAt: Date.now(),
  });
  return built.playerIndex;
}

export function getTeamHistory(
  mode: StatsSampleMode = activeSampleMode
): Map<string, TeamMatchLine[]> {
  return cacheByKey.get(cacheKey(mode))?.teamIndex ?? new Map();
}

export function getPlayerStats(
  playerId: number,
  mode: StatsSampleMode = activeSampleMode
): PlayerTournamentStats | null {
  return cacheByKey.get(cacheKey(mode))?.playerIndex.get(playerId) ?? null;
}

export async function getFixtures(): Promise<RawFixture[]> {
  const league = (await getLeague(activeLeagueId)) as any;
  const fromLeague = parseFixtures(league);

  const meta = footballCompetition(activeCompetitionId);
  if (!meta?.dateFixtureNamePattern) return fromLeague;

  // CL qualification (and similar) aren't on the main league page — pull from
  // FotMob's date feed and merge.
  const { discoverFixturesByDate } = await import("./date-fixtures");
  const discovered = await discoverFixturesByDate(meta.dateFixtureNamePattern);
  const byId = new Map<number, RawFixture>();
  for (const fx of fromLeague) byId.set(fx.id, fx);
  for (const fx of discovered) byId.set(fx.id, fx);
  const merged = [...byId.values()].sort((a, b) =>
    a.kickoff.localeCompare(b.kickoff)
  );
  console.log(
    `  fixtures: ${fromLeague.length} from league ${activeLeagueId} + ${discovered.length} from date feed → ${merged.length} unique (${merged.filter((f) => !f.finished).length} upcoming)`
  );
  return merged;
}

export async function getLeagueOverview(): Promise<any> {
  return getLeague(activeLeagueId);
}

export { PRIMARY_LEAGUE_ID, PRIMARY_LEAGUE_ID as WC_LEAGUE_ID };
