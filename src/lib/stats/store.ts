import { buildStatsIndex } from "./index-build";
import { getLeague, WC_LEAGUE_ID } from "./fotmob";
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

interface ModeCache {
  playerIndex: Map<number, PlayerTournamentStats>;
  teamIndex: Map<string, TeamMatchLine[]>;
  builtAt: number;
}

const INDEX_TTL = 15 * 60_000;
const cacheByMode = new Map<StatsSampleMode, ModeCache>();
let activeSampleMode: StatsSampleMode = DEFAULT_SAMPLE_MODE;

export function setActiveSampleMode(mode: StatsSampleMode): void {
  activeSampleMode = mode;
}

export function getActiveSampleMode(): StatsSampleMode {
  return activeSampleMode;
}

export function clearPlayerIndexCache(mode?: StatsSampleMode): void {
  if (mode) cacheByMode.delete(mode);
  else cacheByMode.clear();
}

export async function ensurePlayerIndex(
  mode: StatsSampleMode = activeSampleMode
): Promise<Map<number, PlayerTournamentStats>> {
  const hit = cacheByMode.get(mode);
  if (hit && Date.now() - hit.builtAt < INDEX_TTL) {
    return hit.playerIndex;
  }

  const built = await buildStatsIndex(mode);
  cacheByMode.set(mode, {
    playerIndex: built.playerIndex,
    teamIndex: built.teamIndex,
    builtAt: Date.now(),
  });
  return built.playerIndex;
}

export function getTeamHistory(
  mode: StatsSampleMode = activeSampleMode
): Map<string, TeamMatchLine[]> {
  return cacheByMode.get(mode)?.teamIndex ?? new Map();
}

export function getPlayerStats(
  playerId: number,
  mode: StatsSampleMode = activeSampleMode
): PlayerTournamentStats | null {
  return cacheByMode.get(mode)?.playerIndex.get(playerId) ?? null;
}

export async function getFixtures(): Promise<RawFixture[]> {
  const league = (await getLeague()) as any;
  return parseFixtures(league);
}

export async function getLeagueOverview(): Promise<any> {
  return getLeague();
}

export { WC_LEAGUE_ID };
