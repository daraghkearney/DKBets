import { getLeague, getMatchDetails, pool, WC_LEAGUE_ID } from "./fotmob";
import {
  parseFixtures,
  parseLineupSide,
  parseMatchPlayerLines,
  parsePlayerMeta,
  sumLines,
  per90,
  type RawFixture,
} from "./parse";
import type { PlayerMatchLine, PlayerTournamentStats } from "./types";

/** In-memory tournament index built from finished FotMob match details. */
let indexBuiltAt = 0;
const INDEX_TTL = 15 * 60_000;
let playerIndex = new Map<number, PlayerTournamentStats>();
let finishedIds: number[] = [];

export async function ensurePlayerIndex(): Promise<Map<number, PlayerTournamentStats>> {
  if (playerIndex.size > 0 && Date.now() - indexBuiltAt < INDEX_TTL) {
    return playerIndex;
  }

  const league = (await getLeague()) as any;
  const fixtures = parseFixtures(league);
  finishedIds = fixtures.filter((f) => f.finished).map((f) => f.id);

  const linesByPlayer = new Map<number, PlayerMatchLine[]>();
  const meta = new Map<number, { name: string; teamId: number; teamName: string }>();

  const results = await pool(finishedIds, 4, async (id) => {
    const raw = (await getMatchDetails(id, true)) as any;
    return {
      lines: parseMatchPlayerLines(id, raw),
      meta: parsePlayerMeta(raw),
    };
  });

  for (const result of results) {
    if (!result) continue;
    for (const [pid, line] of result.lines) {
      if (!linesByPlayer.has(pid)) linesByPlayer.set(pid, []);
      linesByPlayer.get(pid)!.push(line);
    }
    for (const [pid, m] of result.meta) {
      meta.set(pid, m);
    }
  }

  playerIndex = new Map();
  for (const [pid, lines] of linesByPlayer) {
    const m = meta.get(pid);
    const totals = sumLines(lines);
    playerIndex.set(pid, {
      playerId: pid,
      name: m?.name ?? `Player ${pid}`,
      teamId: m?.teamId ?? 0,
      teamName: m?.teamName ?? "",
      lines,
      totals,
      per90: per90(totals),
    });
  }

  indexBuiltAt = Date.now();
  return playerIndex;
}

export function getPlayerStats(playerId: number): PlayerTournamentStats | null {
  return playerIndex.get(playerId) ?? null;
}

export async function getFixtures(): Promise<RawFixture[]> {
  const league = (await getLeague()) as any;
  return parseFixtures(league);
}

export async function getLeagueOverview(): Promise<any> {
  return getLeague();
}

export { WC_LEAGUE_ID };
