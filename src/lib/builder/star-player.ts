import { normPlayer } from "./bet365";
import { combineOdds, combineProbability, effectiveHitRate } from "./odds";
import { slipFromLegs } from "./legs";
import type { BuilderLeg, BuilderSlip, LegCategory } from "./types";
import type {
  MatchDetailPayload,
  PickStat,
  PlayerMatchLine,
  PlayerTournamentStats,
} from "@/lib/stats/types";

export interface StarPlayerGemStat {
  label: string;
  category: LegCategory;
  hitRate: number;
  sample: number;
  tournamentHits: number;
  tournamentSample: number;
  h2hHits?: number;
  h2hSample?: number;
}

export interface StarPlayerSpecial {
  matchId: number;
  matchLabel: string;
  kickoff: string;
  stage: string;
  playerId: number;
  playerName: string;
  teamName: string;
  positionLabel?: string;
  gemStat: StarPlayerGemStat;
  slip: BuilderSlip | null;
}

export interface StarPlayersPayload {
  entries: StarPlayerSpecial[];
  generatedAt: string;
}

interface StatTemplate {
  category: LegCategory;
  label: (name: string, threshold: number) => string;
  test: (line: PlayerMatchLine, threshold: number) => boolean;
  thresholds: number[];
}

const STAT_TEMPLATES: StatTemplate[] = [
  {
    category: "shots",
    label: (n, t) => `${n} ${t}+ Shots`,
    test: (l, t) => l.shots >= t,
    thresholds: [1, 2, 3],
  },
  {
    category: "sot",
    label: (n, t) => `${n} ${t}+ Shots on Target`,
    test: (l, t) => l.shotsOnTarget >= t,
    thresholds: [1, 2],
  },
  {
    category: "fouls",
    label: (n, t) => `${n} ${t}+ Fouls Committed`,
    test: (l, t) => l.foulsCommitted >= t,
    thresholds: [1, 2],
  },
  {
    category: "foulsWon",
    label: (n, t) => `${n} ${t}+ Fouls Won`,
    test: (l, t) => l.foulsWon >= t,
    thresholds: [1, 2],
  },
  {
    category: "tackles",
    label: (n, t) => `${n} ${t}+ Tackles`,
    test: (l, t) => l.tackles >= t,
    thresholds: [1, 2],
  },
];

function collectPlayers(detail: MatchDetailPayload): Array<{
  stats: PlayerTournamentStats;
  positionLabel?: string;
}> {
  const seen = new Set<number>();
  const out: Array<{ stats: PlayerTournamentStats; positionLabel?: string }> =
    [];

  for (const mu of detail.matchups) {
    for (const side of [mu.a, mu.b]) {
      if (!side.stats || seen.has(side.stats.playerId)) continue;
      seen.add(side.stats.playerId);
      out.push({
        stats: side.stats,
        positionLabel: side.player.positionLabel,
      });
    }
  }
  return out;
}

function picksForPlayer(picks: PickStat[], playerName: string): PickStat[] {
  const target = normPlayer(playerName);
  return picks.filter((p) => normPlayer(p.playerName) === target);
}

function buildStatCandidates(
  player: PlayerTournamentStats,
  picks: PickStat[]
): StarPlayerGemStat[] {
  const candidates: StarPlayerGemStat[] = [];

  for (const tpl of STAT_TEMPLATES) {
    for (const threshold of tpl.thresholds) {
      const lines = player.lines;
      if (lines.length < 2) continue;
      const hits = lines.filter((l) => tpl.test(l, threshold)).length;
      const rate = hits / lines.length;
      if (rate < 0.5) continue;

      candidates.push({
        label: tpl.label(player.name, threshold),
        category: tpl.category,
        hitRate: effectiveHitRate(rate, lines.length),
        sample: lines.length,
        tournamentHits: hits,
        tournamentSample: lines.length,
      });
    }
  }

  for (const pick of picks) {
    if (pick.sample < 2) continue;
    candidates.push({
      label: pick.label,
      category: categoryFromPickLabel(pick.label),
      hitRate: effectiveHitRate(pick.rate, pick.sample),
      sample: pick.sample,
      tournamentHits: pick.tournamentHits,
      tournamentSample: pick.tournamentSample,
      h2hHits: pick.h2hHits,
      h2hSample: pick.h2hSample,
    });
  }

  return candidates.sort(
    (a, b) => b.hitRate - a.hitRate || b.sample - a.sample
  );
}

function categoryFromPickLabel(label: string): LegCategory {
  const text = label.toLowerCase();
  if (text.includes("shots on target") || text.includes("sot")) return "sot";
  if (text.includes("fouls won") || text.includes("fouled")) return "foulsWon";
  if (text.includes("foul")) return "fouls";
  if (text.includes("tackle")) return "tackles";
  if (text.includes("card")) return "cards";
  if (text.includes("shot")) return "shots";
  return "shots";
}

function scoreStarPlayer(
  player: PlayerTournamentStats,
  candidates: StarPlayerGemStat[],
  positionLabel?: string
): number {
  const bestRate = candidates[0]?.hitRate ?? 0;
  const strong = candidates.filter((c) => c.hitRate >= 0.75).length;
  const goals = player.totals.goals;
  const assists = player.totals.assists;
  const forward =
    positionLabel?.toLowerCase().includes("striker") ||
    positionLabel?.toLowerCase().includes("winger") ||
    positionLabel?.toLowerCase().includes("forward");

  return (
    bestRate * 3 +
    strong * 0.15 +
    goals * 0.08 +
    assists * 0.05 +
    (forward ? 0.12 : 0) +
    (player.totals.shots / Math.max(player.totals.matches, 1)) * 0.02
  );
}

/** Minimum combined decimal odds for star player builders (2/1 = 3.0). */
const STAR_MIN_DECIMAL_ODDS = 3.0;
/** Only stack very high-confidence legs. */
const STAR_MIN_LEG_HIT_RATE = 0.72;
const STAR_MIN_LEGS = 2;
const STAR_MAX_LEGS = 6;

function bestLegPerCategory(legs: BuilderLeg[]): BuilderLeg[] {
  const byCat = new Map<LegCategory, BuilderLeg>();
  for (const leg of legs) {
    const cur = byCat.get(leg.category);
    if (!cur || leg.hitRate > cur.hitRate) byCat.set(leg.category, leg);
  }
  return [...byCat.values()].sort((a, b) => b.hitRate - a.hitRate);
}

function* combinations<T>(items: T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  if (size > items.length) return;
  for (let i = 0; i <= items.length - size; i++) {
    const head = items[i]!;
    for (const tail of combinations(items.slice(i + 1), size - 1)) {
      yield [head, ...tail];
    }
  }
}

/**
 * Multi-leg same-player builder: stack the highest-probability legs until
 * combined Bet365 odds reach at least 2/1 (decimal 3.0+).
 */
export function buildStarPlayerSlip(
  pool: BuilderLeg[],
  playerName: string,
  matchLabel: string
): BuilderSlip | null {
  const target = normPlayer(playerName);
  const playerLegs = pool.filter(
    (l) =>
      l.type === "player" &&
      l.playerName &&
      normPlayer(l.playerName) === target &&
      l.hitRate >= STAR_MIN_LEG_HIT_RATE
  );
  const distinct = bestLegPerCategory(playerLegs);
  if (distinct.length < STAR_MIN_LEGS) return null;

  const maxSize = Math.min(STAR_MAX_LEGS, distinct.length);
  let best: BuilderLeg[] | null = null;
  let bestProb = 0;

  for (let size = STAR_MIN_LEGS; size <= maxSize; size++) {
    for (const combo of combinations(distinct, size)) {
      if (combineOdds(combo) < STAR_MIN_DECIMAL_ODDS) continue;
      const prob = combineProbability(combo);
      if (
        prob > bestProb ||
        (Math.abs(prob - bestProb) < 1e-9 &&
          combo.length < (best?.length ?? 99))
      ) {
        bestProb = prob;
        best = combo;
      }
    }
  }

  // Greedy fallback: add best legs until 2/1+ when combo search finds nothing
  if (!best) {
    const greedy: BuilderLeg[] = [];
    for (const leg of distinct) {
      greedy.push(leg);
      if (
        greedy.length >= STAR_MIN_LEGS &&
        combineOdds(greedy) >= STAR_MIN_DECIMAL_ODDS
      ) {
        best = [...greedy];
        break;
      }
    }
  }

  if (!best || best.length < STAR_MIN_LEGS) return null;
  if (combineOdds(best) < STAR_MIN_DECIMAL_ODDS) return null;

  return slipFromLegs(
    `star-${best[0]!.matchId}-${target}`,
    `Star Player — ${playerName}`,
    best,
    `2/1+ · ${matchLabel}`
  );
}

export function buildStarPlayerSpecial(
  detail: MatchDetailPayload,
  matchLegs: BuilderLeg[]
): StarPlayerSpecial | null {
  const { fixture } = detail;
  const matchLabel = `${fixture.home} v ${fixture.away}`;
  const allPicks = detail.matchups.flatMap((m) => m.picks);
  const players = collectPlayers(detail);
  if (!players.length) return null;

  let bestPlayer: (typeof players)[0] | null = null;
  let bestCandidates: StarPlayerGemStat[] = [];
  let bestScore = -1;

  for (const entry of players) {
    const picks = picksForPlayer(allPicks, entry.stats.name);
    const candidates = buildStatCandidates(entry.stats, picks);
    if (!candidates.length) continue;
    const score = scoreStarPlayer(
      entry.stats,
      candidates,
      entry.positionLabel
    );
    if (score > bestScore) {
      bestScore = score;
      bestPlayer = entry;
      bestCandidates = candidates;
    }
  }

  if (!bestPlayer || !bestCandidates.length) return null;

  const { stats, positionLabel } = bestPlayer;
  const gemStat = bestCandidates[0]!;
  const slip = buildStarPlayerSlip(matchLegs, stats.name, matchLabel);

  return {
    matchId: fixture.id,
    matchLabel,
    kickoff: fixture.kickoff,
    stage: fixture.stage,
    playerId: stats.playerId,
    playerName: stats.name,
    teamName: stats.teamName,
    positionLabel,
    gemStat,
    slip,
  };
}

export async function buildStarPlayersPayload(
  legs: BuilderLeg[],
  fixtures: Array<{ id: number }>,
  loadDetail: (id: number) => Promise<MatchDetailPayload | null>
): Promise<StarPlayersPayload> {
  const entries: StarPlayerSpecial[] = [];

  for (const fx of fixtures) {
    const detail = await loadDetail(fx.id);
    if (!detail) continue;
    const matchLegs = legs.filter((l) => l.matchId === fx.id);
    const special = buildStarPlayerSpecial(detail, matchLegs);
    if (special) entries.push(special);
  }

  entries.sort(
    (a, b) =>
      new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );

  return {
    entries,
    generatedAt: new Date().toISOString(),
  };
}
