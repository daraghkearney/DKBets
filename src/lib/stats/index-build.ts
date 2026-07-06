import { getLeague, getMatchDetails, getPlayerData, pool } from "./fotmob";
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
  if (isQualificationStage(stage)) return "World Cup Qualification";
  if (mode === "last50") return "All Competitions";
  if (mode === "alltime-nt") return "National Team";
  return "World Cup";
}

const CLUB_LEAGUE_RE =
  /premier league|la liga|serie a|bundesliga|ligue 1|champions league|europa league|conference league|fa cup|copa del rey|dfb-pokal|coupe de france|carabao|mls|eredivisie|primeira liga|süper lig|super lig|scottish prem|championship|league one|league two|segunda|serie b|2\. bundesliga|ligue 2|jupiler|pro league|süper|eredivisie/i;

function isInternationalCompetition(name: string): boolean {
  const text = name.toLowerCase();
  if (CLUB_LEAGUE_RE.test(text)) return false;
  return (
    /world cup|euro|nations|copa america|afcon|asian cup|concacaf|qualif|international|friendly|olympic|nations league|uefa|conmebol|caf |afc |ofc /i.test(
      text
    ) || text.includes("national")
  );
}

async function ingestFinishedMatches(
  fixtures: RawFixture[],
  mode: StatsSampleMode
): Promise<BuiltStatsIndex> {
  const finishedById = new Map(fixtures.map((f) => [f.id, f]));
  const linesByPlayer = new Map<number, PlayerMatchLine[]>();
  const meta = new Map<number, { name: string; teamId: number; teamName: string }>();
  const allTeamLines: TeamMatchLine[] = [];

  const results = await pool(
    fixtures.map((f) => f.id),
    4,
    async (id) => {
      const raw = (await getMatchDetails(id, true)) as any;
      const fx = finishedById.get(id);
      const competition = fx
        ? competitionLabel(fx.stage, mode)
        : competitionLabel("World Cup", mode);
      const teamLines =
        fx && raw
          ? parseTeamMatchLines(id, raw, fx.home, fx.away)
          : [];
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
  const league = (await getLeague()) as any;
  const fixtures = parseFixtures(league).filter((f) => f.finished);
  const filtered =
    mode === "wc2026"
      ? fixtures.filter((f) => !isQualificationStage(f.stage))
      : fixtures;
  return ingestFinishedMatches(filtered, mode);
}

async function collectSquadPlayerIds(): Promise<number[]> {
  const league = (await getLeague()) as any;
  const fixtures = parseFixtures(league);
  const finished = fixtures.filter((f) => f.finished);
  const ids = new Set<number>();

  const finishedSample = finished.slice(0, Math.min(finished.length, 12));
  await pool(finishedSample, 3, async (fx) => {
    const raw = (await getMatchDetails(fx.id, true)) as any;
    for (const p of Object.values(raw?.content?.playerStats ?? {}) as any[]) {
      if (p?.id) ids.add(Number(p.id));
    }
  });

  const upcoming = fixtures.filter((f) => !f.finished).slice(0, 8);
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

  return [...ids];
}

async function buildFromPlayerRecentMatches(
  mode: "last50" | "alltime-nt"
): Promise<BuiltStatsIndex> {
  const playerIds = await collectSquadPlayerIds();
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

    const filtered =
      mode === "alltime-nt"
        ? recent.filter((m: { competition: string }) =>
            isInternationalCompetition(m.competition)
          )
        : recent;

    const capped = filtered.slice(0, mode === "last50" ? 50 : filtered.length);
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

  const uniqueMatchIds = [...new Set([...matchMeta.keys()])];
  const linesByPlayer = new Map<number, PlayerMatchLine[]>();
  const meta = new Map<number, { name: string; teamId: number; teamName: string }>();
  const allTeamLines: TeamMatchLine[] = [];

  await pool(uniqueMatchIds, 4, async (matchId) => {
    const raw = (await getMatchDetails(matchId, true)) as any;
    const mm = matchMeta.get(matchId);
    const competition =
      mm?.competition ??
      (mode === "last50" ? "All Competitions" : "National Team");
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
  });

  // Keep only lines for matches in each player's capped list
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
  if (mode === "wc2026" || mode === "wc-qual") {
    return buildFromLeagueFixtures(mode);
  }
  return buildFromPlayerRecentMatches(mode);
}
