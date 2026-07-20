import {
  clearFotmobCache,
  getLeague,
  getMatchDetails,
  getPlayerData,
  previousSeasonFromLeague,
  PRIMARY_LEAGUE_ID,
  pool,
} from "./fotmob";
import {
  parseFixtures,
  parseMatchPlayerLines,
  parsePlayerMeta,
  per90,
  sumLines,
  type RawFixture,
} from "./parse";
import type { StatsSampleMode } from "./sample-mode";
import {
  indexTeamLines,
  parseTeamMatchLines,
  type TeamMatchLine,
} from "./team-lines";
import type { PlayerMatchLine, PlayerTournamentStats } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BuiltStatsIndex {
  playerIndex: Map<number, PlayerTournamentStats>;
  teamIndex: Map<string, TeamMatchLine[]>;
}

function isQualificationStage(stage: string): boolean {
  const s = String(stage ?? "").toLowerCase();
  return (
    s.includes("qualif") ||
    s.includes("play-off") ||
    s.includes("playoff") ||
    s.includes("prelim")
  );
}

function competitionLabel(stage: string, mode: StatsSampleMode): string {
  if (mode === "last50") return "All Competitions";
  if (isQualificationStage(stage)) return "Qualification";
  return "Premier League";
}

/** Prefer current season; if no finished matches yet (preseason), use prior season. */
async function leagueWithFinishedFixtures(): Promise<{
  league: any;
  fixtures: RawFixture[];
  seasonUsed: string | undefined;
}> {
  const current = (await getLeague()) as any;
  const currentFinished = parseFixtures(current).filter((f) => f.finished);
  if (currentFinished.length > 0) {
    return {
      league: current,
      fixtures: currentFinished,
      seasonUsed: current?.details?.selectedSeason,
    };
  }

  const prev = previousSeasonFromLeague(current);
  if (!prev) {
    return { league: current, fixtures: [], seasonUsed: undefined };
  }

  console.log(
    `  stats: current season has 0 finished matches — using ${prev} for hit rates`
  );
  const prior = (await getLeague(PRIMARY_LEAGUE_ID, prev)) as any;
  const priorFinished = parseFixtures(prior).filter((f) => f.finished);
  return {
    league: prior,
    fixtures: priorFinished,
    seasonUsed: prev,
  };
}

async function ingestFinishedMatches(
  fixtures: RawFixture[],
  mode: StatsSampleMode
): Promise<BuiltStatsIndex> {
  const finishedById = new Map(fixtures.map((f) => [f.id, f]));
  const linesByPlayer = new Map<number, PlayerMatchLine[]>();
  const meta = new Map<
    number,
    { name: string; teamId: number; teamName: string }
  >();
  const allTeamLines: TeamMatchLine[] = [];

  const results = await pool(
    fixtures.map((f) => f.id),
    4,
    async (id) => {
      const raw = (await getMatchDetails(id, true)) as any;
      const fx = finishedById.get(id);
      const competition = fx
        ? competitionLabel(fx.stage, mode)
        : competitionLabel("Premier League", mode);
      const teamLines =
        fx && raw ? parseTeamMatchLines(id, raw, fx.home, fx.away) : [];
      const lines = parseMatchPlayerLines(id, raw, competition);
      return { lines, meta: parsePlayerMeta(raw), teamLines };
    }
  );

  for (const result of results) {
    if (!result) continue;
    allTeamLines.push(...result.teamLines);
    for (const [pid, line] of result.lines) {
      if (!linesByPlayer.has(pid)) linesByPlayer.set(pid, []);
      linesByPlayer.get(pid)!.push(line);
    }
    for (const [pid, m] of result.meta) {
      meta.set(pid, m);
    }
  }

  return assembleIndex(linesByPlayer, meta, allTeamLines);
}

function assembleIndex(
  linesByPlayer: Map<number, PlayerMatchLine[]>,
  meta: Map<number, { name: string; teamId: number; teamName: string }>,
  allTeamLines: TeamMatchLine[]
): BuiltStatsIndex {
  const playerIndex = new Map<number, PlayerTournamentStats>();
  for (const [pid, lines] of linesByPlayer) {
    const sorted = [...lines].sort((a, b) => b.date.localeCompare(a.date));
    const m = meta.get(pid);
    const totals = sumLines(sorted);
    playerIndex.set(pid, {
      playerId: pid,
      name: m?.name ?? `Player ${pid}`,
      teamId: m?.teamId ?? 0,
      teamName: m?.teamName ?? "",
      lines: sorted,
      totals,
      per90: per90(totals),
    });
  }
  return { playerIndex, teamIndex: indexTeamLines(allTeamLines) };
}

async function buildFromLeagueFixtures(
  mode: StatsSampleMode
): Promise<BuiltStatsIndex> {
  const { fixtures } = await leagueWithFinishedFixtures();
  const filtered =
    mode === "epl-season"
      ? fixtures.filter((f) => !isQualificationStage(f.stage))
      : fixtures;
  // Full PL season is ~380 matches — cap ingest for CI time; prefer recent.
  const capped =
    filtered.length > 120
      ? [...filtered]
          .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
          .slice(0, 120)
      : filtered;
  if (filtered.length > capped.length) {
    console.log(
      `  stats: ingesting ${capped.length}/${filtered.length} finished matches (recent cap)`
    );
  }
  return ingestFinishedMatches(capped, mode);
}

async function collectSquadPlayerIds(): Promise<number[]> {
  const { fixtures } = await leagueWithFinishedFixtures();
  const ids = new Set<number>();

  const finishedSample = fixtures.slice(0, Math.min(fixtures.length, 16));
  await pool(finishedSample, 3, async (fx) => {
    const raw = (await getMatchDetails(fx.id, true)) as any;
    for (const p of Object.values(raw?.content?.playerStats ?? {}) as any[]) {
      if (p?.id) ids.add(Number(p.id));
    }
  });

  // Also try current-season upcoming lineups when available.
  const current = (await getLeague()) as any;
  const upcoming = parseFixtures(current)
    .filter((f) => !f.finished)
    .slice(0, 8);
  await pool(upcoming, 3, async (fx) => {
    const raw = (await getMatchDetails(fx.id, false)) as any;
    for (const side of [
      raw?.content?.lineup?.homeTeam?.starters,
      raw?.content?.lineup?.awayTeam?.starters,
    ]) {
      for (const p of side ?? []) {
        if (p?.id) ids.add(Number(p.id));
      }
    }
  });

  console.log(`  stats: seeded ${ids.size} squad player id(s)`);
  return [...ids];
}

async function buildFromPlayerRecentMatches(
  mode: "last50"
): Promise<BuiltStatsIndex> {
  const playerIds = await collectSquadPlayerIds();
  if (!playerIds.length) {
    console.warn("  stats: no squad player ids — last50 index will be empty");
  }
  const matchMeta = new Map<
    number,
    { competition: string; date: string; opponent?: string }
  >();
  const playerMatchIds = new Map<number, number[]>();

  await pool(playerIds, 6, async (playerId) => {
    const data = (await getPlayerData(playerId)) as any;
    const recent = (data?.recentMatches ?? [])
      .filter((m: any) => m?.playedInMatch)
      .map((m: any) => ({
        id: Number(m.id),
        date: String(m.matchDate?.utcTime ?? m.matchDate ?? "").slice(0, 10),
        competition: String(m.leagueName ?? m.stage ?? "Match"),
      }))
      .filter((m: { id: number }) => m.id);

    const capped = recent.slice(0, mode === "last50" ? 50 : recent.length);
    playerMatchIds.set(
      playerId,
      capped.map((m: { id: number }) => m.id)
    );
    for (const m of capped) {
      if (!matchMeta.has(m.id)) {
        matchMeta.set(m.id, {
          competition: m.competition,
          date: m.date,
        });
      }
    }
  });

  clearFotmobCache();

  const uniqueMatchIds = [...new Set([...matchMeta.keys()])];
  const linesByPlayer = new Map<number, PlayerMatchLine[]>();
  const meta = new Map<
    number,
    { name: string; teamId: number; teamName: string }
  >();
  const allTeamLines: TeamMatchLine[] = [];

  const ingestMatch = async (matchId: number) => {
    const raw = (await getMatchDetails(matchId, true)) as any;
    const mm = matchMeta.get(matchId);
    const competition = mm?.competition ?? "All Competitions";
    const header = raw?.general ?? raw?.header ?? {};
    const home = header.homeTeam?.name ?? "?";
    const away = header.awayTeam?.name ?? "?";
    const teamLines = parseTeamMatchLines(matchId, raw, home, away);
    allTeamLines.push(...teamLines);

    const lines = parseMatchPlayerLines(matchId, raw, competition);
    for (const [pid, line] of lines) {
      if (mm?.date) line.date = mm.date;
      if (!linesByPlayer.has(pid)) linesByPlayer.set(pid, []);
      linesByPlayer.get(pid)!.push(line);
    }
    for (const [pid, m] of parsePlayerMeta(raw)) {
      meta.set(pid, m);
    }
  };

  const chunkSize = 80;
  for (let i = 0; i < uniqueMatchIds.length; i += chunkSize) {
    const chunk = uniqueMatchIds.slice(i, i + chunkSize);
    await pool(chunk, 4, ingestMatch);
    clearFotmobCache();
  }

  for (const [pid, allowed] of playerMatchIds) {
    const allowedSet = new Set(allowed);
    const lines = (linesByPlayer.get(pid) ?? []).filter((l) =>
      allowedSet.has(l.matchId)
    );
    if (lines.length) linesByPlayer.set(pid, lines);
    else linesByPlayer.delete(pid);
  }

  return assembleIndex(linesByPlayer, meta, allTeamLines);
}

export async function buildStatsIndex(
  mode: StatsSampleMode
): Promise<BuiltStatsIndex> {
  if (mode === "epl-season") {
    return buildFromLeagueFixtures(mode);
  }
  return buildFromPlayerRecentMatches(mode);
}
