import { buildPositionalMatchups, POSITIONAL_SLOTS } from "./matchups";
import { bestPick, buildPicks, isBanker } from "./picks";
import {
  buildCareerHistory,
  buildH2HLookup,
  discoverH2HPairs,
  lookupH2H,
  pairKey,
} from "./h2h";
import {
  lineupType,
  parseLineupBench,
  parseLineupSide,
} from "./parse";
import { getMatchDetails } from "./fotmob";
import {
  ensurePlayerIndex,
  getFixtures,
  getLeagueOverview,
  getPlayerStats,
} from "./store";
import type {
  BankerPick,
  FixtureSummary,
  MatchDetailPayload,
  Matchup,
  MatchupHistoryRow,
  MatchupSide,
  PickStat,
  PlayerTournamentStats,
} from "./types";

const POSITIONAL_SLOT_ORDER = POSITIONAL_SLOTS.map((s) => s.tag);

export async function loadFixtures(): Promise<FixtureSummary[]> {
  await ensurePlayerIndex();
  const raw = await getFixtures();
  return raw
    .filter((f) => !f.finished)
    .map((f) => ({
      id: f.id,
      home: f.home,
      away: f.away,
      homeId: f.homeId,
      awayId: f.awayId,
      kickoff: f.kickoff,
      stage: f.stage,
      started: f.started,
      finished: f.finished,
    }))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export async function loadAllFixtures(): Promise<FixtureSummary[]> {
  await ensurePlayerIndex();
  const raw = await getFixtures();
  return raw
    .map((f) => ({
      id: f.id,
      home: f.home,
      away: f.away,
      homeId: f.homeId,
      awayId: f.awayId,
      kickoff: f.kickoff,
      stage: f.stage,
      started: f.started,
      finished: f.finished,
    }))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export async function loadPlayerLeaderboard(): Promise<{
  byRating: any[];
  byGoals: any[];
  byAssists: any[];
  players: PlayerTournamentStats[];
}> {
  await ensurePlayerIndex();
  const league = (await getLeagueOverview()) as any;
  const top = league?.overview?.topPlayers ?? {};
  const players = [...(await ensurePlayerIndex()).values()].sort(
    (a, b) => b.totals.shots - a.totals.shots
  );
  return {
    byRating: top.byRating?.players ?? [],
    byGoals: top.byGoals?.players ?? [],
    byAssists: top.byAssists?.players ?? [],
    players,
  };
}

export async function loadMatchDetail(matchId: number): Promise<MatchDetailPayload | null> {
  await ensurePlayerIndex();
  const raw = await getFixtures();
  const fx = raw.find((f) => f.id === matchId);
  if (!fx) return null;

  const payload = (await getMatchDetails(matchId, fx.finished)) as any;
  const lu = payload?.content?.lineup;
  if (!lu) return null;

  const homeName = fx.home;
  const awayName = fx.away;
  const homePlayers = parseLineupSide(lu.homeTeam, homeName);
  const awayPlayers = parseLineupSide(lu.awayTeam, awayName);

  const h2hPairs = await discoverH2HPairs(homePlayers, awayPlayers);
  const h2hLookup = buildH2HLookup(h2hPairs);
  const positional = buildPositionalMatchups(homePlayers, awayPlayers, h2hLookup);

  const positionalKeys = new Set(
    positional.map((p) => pairKey(p.home.id, p.away.id))
  );

  type RawPair = {
    home: import("./types").LineupPlayer;
    away: import("./types").LineupPlayer;
    slot: string;
    kind: "positional" | "notable";
    slotOrder: number;
    sharedIds: number[];
    sharedCount: number;
  };

  const rawPairs: RawPair[] = positional.map((p) => {
    const h2h = lookupH2H(h2hLookup, p.home.id, p.away.id);
    return {
      home: p.home,
      away: p.away,
      slot: p.tag,
      kind: "positional" as const,
      slotOrder: p.slotOrder,
      sharedIds: h2h.sharedIds,
      sharedCount: h2h.count,
    };
  });

  // Cross-position career duels (e.g. Vinícius vs Haaland) — supplementary only.
  for (const p of h2hPairs) {
    if (p.sharedCount < 3) continue;
    const key = pairKey(p.home.id, p.away.id);
    if (positionalKeys.has(key)) continue;
    rawPairs.push({
      home: p.home,
      away: p.away,
      slot: p.tag,
      kind: "notable",
      slotOrder: 100 + rawPairs.length,
      sharedIds: p.sharedIds,
      sharedCount: p.sharedCount,
    });
    positionalKeys.add(key);
  }

  const matchups: Matchup[] = await Promise.all(
    rawPairs.map(async ({ home, away, slot, kind, sharedCount, sharedIds }) => {
      const aStats = getPlayerStats(home.id);
      const bStats = getPlayerStats(away.id);
      const tournamentHistory = buildTournamentHistory(home.id, away.id);
      const history = await buildCareerHistory(
        home.id,
        away.id,
        sharedIds,
        tournamentHistory
      );
      const picks = buildPicks(home.name, away.name, aStats, bStats, history);

      const label =
        kind === "positional"
          ? `${homeName} ${home.positionLabel} vs ${awayName} ${away.positionLabel}`
          : `${home.name} vs ${away.name}`;

      return {
        id: `${home.id}-${away.id}`,
        slot,
        label,
        kind,
        a: side(home, homeName, aStats),
        b: side(away, awayName, bStats),
        careerH2hGames: sharedCount || history.length,
        isCareerRivalry: sharedCount > 0,
        history,
        pickOfTheDay: bestPick(picks),
        picks,
      };
    })
  );

  matchups.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "positional" ? -1 : 1;
    if (a.kind === "notable") {
      return b.careerH2hGames - a.careerH2hGames;
    }
    const slotOrder = (s: string) =>
      POSITIONAL_SLOT_ORDER.indexOf(s) >= 0
        ? POSITIONAL_SLOT_ORDER.indexOf(s)
        : 99;
    return slotOrder(a.slot) - slotOrder(b.slot);
  });

  return {
    fixture: {
      id: fx.id,
      home: fx.home,
      away: fx.away,
      homeId: fx.homeId,
      awayId: fx.awayId,
      kickoff: fx.kickoff,
      stage: fx.stage,
      started: fx.started,
      finished: fx.finished,
    },
    lineupType: lineupType(payload, fx.finished),
    homeFormation: lu.homeTeam?.formation ?? null,
    awayFormation: lu.awayTeam?.formation ?? null,
    homeLineup: homePlayers,
    awayLineup: awayPlayers,
    homeBench: parseLineupBench(lu.homeTeam),
    awayBench: parseLineupBench(lu.awayTeam),
    matchups,
    generatedAt: new Date().toISOString(),
  };
}

function side(
  player: import("./types").LineupPlayer,
  teamName: string,
  stats: PlayerTournamentStats | null
): MatchupSide {
  return { player, teamName, stats };
}

function buildTournamentHistory(aId: number, bId: number): MatchupHistoryRow[] {
  const a = getPlayerStats(aId);
  const b = getPlayerStats(bId);
  if (!a || !b) return [];

  const shared = new Map<number, { a: typeof a.lines[0]; b: typeof b.lines[0] }>();
  for (const la of a.lines) shared.set(la.matchId, { a: la, b: undefined as any });
  for (const lb of b.lines) {
    const hit = shared.get(lb.matchId);
    if (hit) hit.b = lb;
  }

  const rows: MatchupHistoryRow[] = [];
  for (const [matchId, { a: la, b: lb }] of shared) {
    if (!lb) continue;
    rows.push({
      matchId,
      date: la.date,
      competition: la.competition,
      score: "",
      a: la,
      b: lb,
    });
  }
  return rows.sort((x, y) => y.date.localeCompare(x.date));
}

/** Likely props for an upcoming fixture (aggregate high-rate picks). */
export async function loadMatchLikelyProps(matchId: number): Promise<PickStat[]> {
  const detail = await loadMatchDetail(matchId);
  if (!detail) return [];
  const all: PickStat[] = [];
  for (const m of detail.matchups) {
    all.push(...m.picks.filter((p) => p.rate >= 0.6));
  }
  return all.sort((a, b) => b.rate - a.rate).slice(0, 8);
}

export async function loadBankerPicks(day?: string): Promise<BankerPick[]> {
  const fixtures = await loadFixtures();
  const targetDay = day ?? new Date().toISOString().slice(0, 10);
  const todayFx = fixtures.filter((f) => f.kickoff.startsWith(targetDay));

  const bankers: BankerPick[] = [];
  for (const fx of todayFx) {
    const detail = await loadMatchDetail(fx.id);
    if (!detail) continue;
    for (const m of detail.matchups) {
      for (const p of m.picks) {
        if (!isBanker(p)) continue;
        bankers.push({
          ...p,
          matchLabel: `${fx.home} v ${fx.away}`,
          matchupLabel: m.label,
          kickoff: fx.kickoff,
        });
      }
    }
  }

  return bankers.sort((a, b) => b.rate - a.rate || b.sample - a.sample);
}

export async function loadUpcomingWithProps(): Promise<
  Array<FixtureSummary & { likelyProps: PickStat[] }>
> {
  const fixtures = await loadFixtures();
  const slice = fixtures.slice(0, 6);
  const props = await Promise.all(
    slice.map((fx) => loadMatchLikelyProps(fx.id))
  );
  return slice.map((fx, i) => ({ ...fx, likelyProps: props[i] }));
}
