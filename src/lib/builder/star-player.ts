import { findLiveQuote, normPlayer } from "./bet365";
import type { Bet365LiveMap } from "./bet365-live";
import { combineOdds, combineProbability, effectiveHitRate, priceFromBet365Live } from "./odds";
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

/** One fixture — star player from each side. */
export interface StarPlayerFixture {
  matchId: number;
  matchLabel: string;
  kickoff: string;
  stage: string;
  stars: StarPlayerSpecial[];
}

export interface StarPlayersPayload {
  fixtures: StarPlayerFixture[];
  /** @deprecated flat list — use fixtures */
  entries?: StarPlayerSpecial[];
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
  {
    category: "cards",
    label: (n) => `${n} to be Carded`,
    test: (l) => l.yellowCards + l.redCards >= 1,
    thresholds: [1],
  },
];

/** Evens (1/1) — minimum combined decimal target. */
const STAR_TARGET_DECIMAL_MIN = 1.9;
/** Ideal upper band — close to 2/1 without overshooting too far. */
const STAR_TARGET_DECIMAL_IDEAL = 3.0;
const STAR_MIN_LEG_HIT_RATE = 0.58;
const STAR_MIN_LEGS = 2;
const STAR_MAX_LEGS = 10;

/** Designated marquee player per nation (normalized team slug → name tokens). */
const TEAM_MARQUEE: Record<string, string[]> = {
  portugal: ["ronaldo", "cristiano"],
  france: ["mbappe", "kylian"],
  spain: ["yamal", "lamine"],
  morocco: ["hakimi", "achraf"],
  argentina: ["messi", "lionel"],
  egypt: ["salah", "mohamed"],
  brazil: ["neymar", "vinicius", "vini"],
  england: ["kane", "harry", "bellingham"],
  germany: ["musiala", "jamal"],
  netherlands: ["depay", "memphis", "gakpo"],
};

function matchesMarquee(playerName: string, teamName: string): boolean {
  const teamKey = normTeam(teamName);
  const tokens = TEAM_MARQUEE[teamKey];
  if (!tokens?.length) return false;
  const norm = normPlayer(playerName);
  return tokens.some((t) => norm.includes(t));
}

function lineThreshold(market: string): number {
  const match = market.match(/(\d+)\+/);
  return match ? Number(match[1]) : 1;
}

function normTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function collectPlayers(detail: MatchDetailPayload): Array<{
  stats: PlayerTournamentStats;
  positionLabel?: string;
  pickOfDayCount: number;
}> {
  const seen = new Set<number>();
  const pickOfDay = new Map<number, number>();

  for (const mu of detail.matchups) {
    for (const side of [mu.a, mu.b]) {
      if (!side.stats) continue;
      if (mu.pickOfTheDay?.playerId === side.stats.playerId) {
        pickOfDay.set(
          side.stats.playerId,
          (pickOfDay.get(side.stats.playerId) ?? 0) + 1
        );
      }
    }
  }

  const out: Array<{
    stats: PlayerTournamentStats;
    positionLabel?: string;
    pickOfDayCount: number;
  }> = [];

  for (const mu of detail.matchups) {
    for (const side of [mu.a, mu.b]) {
      if (!side.stats || seen.has(side.stats.playerId)) continue;
      seen.add(side.stats.playerId);
      out.push({
        stats: side.stats,
        positionLabel: side.player.positionLabel,
        pickOfDayCount: pickOfDay.get(side.stats.playerId) ?? 0,
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
      if (rate < 0.45) continue;

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

/** Pick the biggest name on each team — attackers and volume shooters rank highest. */
function scoreStarPlayer(
  player: PlayerTournamentStats,
  candidates: StarPlayerGemStat[],
  positionLabel?: string,
  pickOfDayCount = 0
): number {
  const bestRate = candidates[0]?.hitRate ?? 0;
  const strong = candidates.filter((c) => c.hitRate >= 0.7).length;
  const matches = Math.max(player.totals.matches, 1);
  const goals = player.totals.goals;
  const assists = player.totals.assists;
  const shotsPg = player.totals.shots / matches;
  const pos = (positionLabel ?? "").toLowerCase();
  const forward =
    pos.includes("striker") ||
    pos.includes("winger") ||
    pos.includes("forward");
  const attackingMid =
    pos.includes("midfield") && (goals > 0 || assists > 0 || shotsPg >= 1.5);

  return (
    goals * 0.4 +
    assists * 0.22 +
    shotsPg * 0.12 +
    bestRate * 1.8 +
    strong * 0.12 +
    pickOfDayCount * 0.35 +
    (forward ? 0.3 : 0) +
    (attackingMid ? 0.15 : 0) +
    (player.totals.minutes / matches / 90) * 0.08
  );
}

function findMarqueeInIndex(
  teamName: string,
  playerIndex: Map<number, PlayerTournamentStats>,
  allPicks: PickStat[]
): {
  stats: PlayerTournamentStats;
  positionLabel?: string;
  pickOfDayCount: number;
} | null {
  const teamKey = normTeam(teamName);
  const tokens = TEAM_MARQUEE[teamKey];
  if (!tokens?.length) return null;

  for (const stats of playerIndex.values()) {
    if (normTeam(stats.teamName) !== teamKey) continue;
    const norm = normPlayer(stats.name);
    if (!tokens.some((t) => norm.includes(t))) continue;
    const picks = picksForPlayer(allPicks, stats.name);
    if (buildStatCandidates(stats, picks).length) {
      return { stats, positionLabel: undefined, pickOfDayCount: 0 };
    }
  }
  return null;
}

function pickTeamStar(
  players: ReturnType<typeof collectPlayers>,
  teamName: string,
  allPicks: PickStat[],
  playerIndex?: Map<number, PlayerTournamentStats>
): (typeof players)[0] | null {
  const teamKey = normTeam(teamName);
  const squad = players.filter((p) => normTeam(p.stats.teamName) === teamKey);
  if (!squad.length && !playerIndex?.size) return null;

  // Named marquee (Ronaldo, Mbappé, Yamal, etc.) — lineup first, then tournament index
  for (const entry of squad) {
    if (!matchesMarquee(entry.stats.name, teamName)) continue;
    const picks = picksForPlayer(allPicks, entry.stats.name);
    if (buildStatCandidates(entry.stats, picks).length) return entry;
  }

  const indexedMarquee = playerIndex
    ? findMarqueeInIndex(teamName, playerIndex, allPicks)
    : null;
  if (indexedMarquee) return indexedMarquee;

  let best: (typeof players)[0] | null = null;
  let bestScore = -1;

  for (const entry of squad) {
    const picks = picksForPlayer(allPicks, entry.stats.name);
    const candidates = buildStatCandidates(entry.stats, picks);
    if (!candidates.length) continue;
    const score = scoreStarPlayer(
      entry.stats,
      candidates,
      entry.positionLabel,
      entry.pickOfDayCount
    );
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best;
}

function mkStarLeg(
  opts: {
    matchId: number;
    matchLabel: string;
    kickoff: string;
    playerName: string;
    teamName: string;
    market: string;
    category: LegCategory;
    hitRate: number;
    sample: number;
    tournamentHits?: number;
    tournamentSample?: number;
    h2hHits?: number;
    h2hSample?: number;
  },
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): BuilderLeg | null {
  if (opts.hitRate < STAR_MIN_LEG_HIT_RATE || opts.sample < 2) return null;
  if (!liveOdds) return null;

  const threshold = lineThreshold(opts.market);
  const quote = findLiveQuote(
    liveOdds,
    opts.matchId,
    opts.playerName,
    opts.category,
    threshold
  );
  if (!quote) return null;

  const priced = priceFromBet365Live(quote.price);

  return {
    type: "player",
    label: opts.market,
    market: opts.market,
    matchLabel: opts.matchLabel,
    matchId: opts.matchId,
    kickoff: opts.kickoff,
    playerName: opts.playerName,
    teamName: opts.teamName,
    category: opts.category,
    hitRate: opts.hitRate,
    sample: opts.sample,
    tournamentHits: opts.tournamentHits,
    tournamentSample: opts.tournamentSample,
    h2hHits: opts.h2hHits,
    h2hSample: opts.h2hSample,
    id: `${opts.matchId}-star-${opts.playerName}-${opts.market}`
      .replace(/\s+/g, "-")
      .slice(0, 80),
    ...priced,
    bet365Link: quote.link,
    bet365SelectionId: quote.selectionId,
    bet365EventUrl: eventUrls?.get(opts.matchId),
  };
}

function buildPlayerLegPool(
  player: PlayerTournamentStats,
  picks: PickStat[],
  matchId: number,
  matchLabel: string,
  kickoff: string,
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): BuilderLeg[] {
  const legs: BuilderLeg[] = [];
  const seen = new Set<string>();

  const add = (leg: BuilderLeg | null) => {
    if (!leg) return;
    const key = leg.market.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    legs.push(leg);
  };

  for (const tpl of STAT_TEMPLATES) {
    for (const threshold of tpl.thresholds) {
      const lines = player.lines;
      if (lines.length < 2) continue;
      const hits = lines.filter((l) => tpl.test(l, threshold)).length;
      const rate = hits / lines.length;
      const hitRate = effectiveHitRate(rate, lines.length);
      const market = tpl.label(player.name, threshold);
      add(
        mkStarLeg(
          {
            matchId,
            matchLabel,
            kickoff,
            playerName: player.name,
            teamName: player.teamName,
            market,
            category: tpl.category,
            hitRate,
            sample: lines.length,
            tournamentHits: hits,
            tournamentSample: lines.length,
          },
          liveOdds,
          eventUrls
        )
      );
    }
  }

  for (const pick of picks) {
    if (pick.sample < 2) continue;
    const hitRate = effectiveHitRate(pick.rate, pick.sample);
    add(
      mkStarLeg(
        {
          matchId,
          matchLabel,
          kickoff,
          playerName: player.name,
          teamName: player.teamName,
          market: pick.label,
          category: categoryFromPickLabel(pick.label),
          hitRate,
          sample: pick.sample,
          tournamentHits: pick.tournamentHits,
          tournamentSample: pick.tournamentSample,
          h2hHits: pick.h2hHits,
          h2hSample: pick.h2hSample,
        },
        liveOdds,
        eventUrls
      )
    );
  }

  return legs.sort((a, b) => b.hitRate - a.hitRate || b.sample - a.sample);
}

function oddsDistance(decimal: number): number {
  if (decimal < STAR_TARGET_DECIMAL_MIN) return 100 + (STAR_TARGET_DECIMAL_MIN - decimal);
  if (decimal <= STAR_TARGET_DECIMAL_IDEAL) return Math.abs(decimal - 2.45);
  return (decimal - STAR_TARGET_DECIMAL_IDEAL) * 0.5;
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
 * Stack as many high-probability legs as needed to reach evens (1.9+) or close to 2/1.
 */
export function buildStarPlayerSlip(
  legs: BuilderLeg[],
  playerName: string,
  matchLabel: string
): BuilderSlip | null {
  if (legs.length < STAR_MIN_LEGS) return null;

  const pool = legs
    .filter((l) => l.hitRate >= STAR_MIN_LEG_HIT_RATE)
    .sort((a, b) => b.hitRate - a.hitRate || b.sample - a.sample);

  if (pool.length < STAR_MIN_LEGS) return null;

  const maxSize = Math.min(STAR_MAX_LEGS, pool.length);
  let best: BuilderLeg[] | null = null;
  let bestProb = 0;
  let bestDist = Infinity;

  for (let size = STAR_MIN_LEGS; size <= maxSize; size++) {
    for (const combo of combinations(pool, size)) {
      const decimal = combineOdds(combo);
      if (decimal < STAR_TARGET_DECIMAL_MIN) continue;
      const prob = combineProbability(combo);
      const dist = oddsDistance(decimal);
      if (
        prob > bestProb + 1e-9 ||
        (Math.abs(prob - bestProb) < 1e-9 && dist < bestDist) ||
        (Math.abs(prob - bestProb) < 1e-9 &&
          Math.abs(dist - bestDist) < 1e-9 &&
          combo.length < (best?.length ?? 99))
      ) {
        bestProb = prob;
        bestDist = dist;
        best = combo;
      }
    }
  }

  // Greedy: keep adding top legs until evens+
  if (!best) {
    const greedy: BuilderLeg[] = [];
    for (const leg of pool) {
      greedy.push(leg);
      if (
        greedy.length >= STAR_MIN_LEGS &&
        combineOdds(greedy) >= STAR_TARGET_DECIMAL_MIN
      ) {
        best = [...greedy];
        break;
      }
    }
  }

  // Last resort: use as many top legs as available
  if (!best && pool.length >= STAR_MIN_LEGS) {
    best = pool.slice(0, Math.min(STAR_MAX_LEGS, pool.length));
  }

  if (!best || best.length < STAR_MIN_LEGS) return null;

  const decimal = combineOdds(best);
  const targetLabel =
    decimal >= STAR_TARGET_DECIMAL_IDEAL
      ? `2/1+ · ${matchLabel}`
      : `Evens+ · ${matchLabel}`;

  return slipFromLegs(
    `star-${best[0]!.matchId}-${normPlayer(playerName)}`,
    `Star Player — ${playerName}`,
    best,
    targetLabel
  );
}

function buildStarForTeam(
  detail: MatchDetailPayload,
  teamName: string,
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>,
  playerIndex?: Map<number, PlayerTournamentStats>
): StarPlayerSpecial | null {
  const { fixture } = detail;
  const matchLabel = `${fixture.home} v ${fixture.away}`;
  const allPicks = detail.matchups.flatMap((m) => m.picks);
  const players = collectPlayers(detail);
  const star = pickTeamStar(players, teamName, allPicks, playerIndex);
  if (!star) return null;

  const picks = picksForPlayer(allPicks, star.stats.name);
  const candidates = buildStatCandidates(star.stats, picks);
  if (!candidates.length) return null;

  const legPool = buildPlayerLegPool(
    star.stats,
    picks,
    fixture.id,
    matchLabel,
    fixture.kickoff,
    liveOdds,
    eventUrls
  );
  const slip = buildStarPlayerSlip(legPool, star.stats.name, matchLabel);

  return {
    matchId: fixture.id,
    matchLabel,
    kickoff: fixture.kickoff,
    stage: fixture.stage,
    playerId: star.stats.playerId,
    playerName: star.stats.name,
    teamName: star.stats.teamName,
    positionLabel: star.positionLabel,
    gemStat: candidates[0]!,
    slip,
  };
}

export function buildStarPlayerFixture(
  detail: MatchDetailPayload,
  matchLegs: BuilderLeg[],
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>,
  playerIndex?: Map<number, PlayerTournamentStats>
): StarPlayerFixture | null {
  const { fixture } = detail;
  const matchLabel = `${fixture.home} v ${fixture.away}`;
  const stars: StarPlayerSpecial[] = [];

  for (const team of [fixture.home, fixture.away]) {
    const special = buildStarForTeam(
      detail,
      team,
      liveOdds,
      eventUrls,
      playerIndex
    );
    if (special) stars.push(special);
  }

  if (!stars.length) return null;

  return {
    matchId: fixture.id,
    matchLabel,
    kickoff: fixture.kickoff,
    stage: fixture.stage,
    stars,
  };
}

/** @deprecated use buildStarPlayerFixture */
export function buildStarPlayerSpecial(
  detail: MatchDetailPayload,
  matchLegs: BuilderLeg[]
): StarPlayerSpecial | null {
  const fx = buildStarPlayerFixture(detail, matchLegs);
  return fx?.stars[0] ?? null;
}

export async function buildStarPlayersPayload(
  legs: BuilderLeg[],
  fixtures: Array<{ id: number }>,
  loadDetail: (id: number) => Promise<MatchDetailPayload | null>,
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>,
  playerIndex?: Map<number, PlayerTournamentStats>
): Promise<StarPlayersPayload> {
  const fixtureGroups: StarPlayerFixture[] = [];

  for (const fx of fixtures) {
    const detail = await loadDetail(fx.id);
    if (!detail) continue;
    const matchLegs = legs.filter((l) => l.matchId === fx.id);
    const group = buildStarPlayerFixture(
      detail,
      matchLegs,
      liveOdds,
      eventUrls,
      playerIndex
    );
    if (group) fixtureGroups.push(group);
  }

  fixtureGroups.sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );

  const entries = fixtureGroups.flatMap((f) => f.stars);

  return {
    fixtures: fixtureGroups,
    entries,
    generatedAt: new Date().toISOString(),
  };
}
