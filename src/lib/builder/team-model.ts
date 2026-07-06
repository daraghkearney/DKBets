import { findLiveQuote, findTeamLiveQuote, normPlayer } from "./bet365";
import type { Bet365LiveMap } from "./bet365-live";
import { slipFromLegs } from "./legs";
import { combineOdds, combineProbability, priceFromBet365Live } from "./odds";
import type { BuilderLeg, BuilderSlip, LegCategory } from "./types";
import type { FixtureSummary, PlayerTournamentStats } from "@/lib/stats/types";
import {
  normTeamKey,
  type TeamMatchLine,
} from "@/lib/stats/team-lines";

const PLACEHOLDER_TEAM = /\/|winner|loser|tbd|round|group/i;
const MIN_GAMES = 2;
const TARGET_DECIMAL_MIN = 1.9;
const TARGET_DECIMAL_IDEAL = 3.0;
const MIN_LEGS = 2;
const MAX_LEGS = 12;

export interface TeamModelGameStat {
  matchId: number;
  opponent: string;
  value: number;
}

export interface TeamModelPerfectProp {
  kind: "team" | "player";
  label: string;
  market: string;
  category: LegCategory;
  hits: number;
  sample: number;
  playerName?: string;
  teamMarket?: string;
  threshold: number;
  games: TeamModelGameStat[];
}

export interface TeamModelEntry {
  teamName: string;
  teamKey: string;
  gamesPlayed: number;
  nextMatchId: number | null;
  nextMatchLabel: string | null;
  nextKickoff: string | null;
  nextOpponent: string | null;
  perfectProps: TeamModelPerfectProp[];
  pricedLegs: number;
  slip: BuilderSlip | null;
  history: TeamMatchLine[];
}

export interface TeamModelPayload {
  teams: TeamModelEntry[];
  generatedAt: string;
}

type TeamField = keyof Pick<
  TeamMatchLine,
  "corners" | "shots" | "shotsOnTarget" | "fouls" | "yellowCards"
>;

interface TeamStatTemplate {
  field: TeamField;
  label: (team: string, n: number) => string;
  maxScan: number;
  teamMarket: (n: number) => string | null;
}

const TEAM_STAT_TEMPLATES: TeamStatTemplate[] = [
  {
    field: "corners",
    label: (t, n) => `${t} ${n}+ Corners`,
    maxScan: 12,
    teamMarket: (n) => (n >= 4 ? "corners_over_45" : null),
  },
  {
    field: "shots",
    label: (t, n) => `${t} ${n}+ Shots`,
    maxScan: 20,
    teamMarket: (n) => (n >= 1 ? "shots_over_05" : null),
  },
  {
    field: "shotsOnTarget",
    label: (t, n) => `${t} ${n}+ Shots on Target`,
    maxScan: 15,
    teamMarket: (n) => (n >= 1 ? "sot_over_05" : null),
  },
  {
    field: "fouls",
    label: (t, n) => `${t} ${n}+ Fouls`,
    maxScan: 15,
    teamMarket: () => null,
  },
  {
    field: "yellowCards",
    label: (t, n) => `${t} ${n}+ Yellow Cards`,
    maxScan: 3,
    teamMarket: () => null,
  },
];

interface PlayerStatTemplate {
  field: keyof Pick<
    PlayerTournamentStats["lines"][0],
    | "shots"
    | "shotsOnTarget"
    | "foulsCommitted"
    | "foulsWon"
    | "tackles"
  >;
  category: LegCategory;
  label: (name: string, n: number) => string;
  maxScan: number;
}

const PLAYER_STAT_TEMPLATES: PlayerStatTemplate[] = [
  {
    field: "shots",
    category: "shots",
    label: (n, t) => `${n} ${t}+ Shots`,
    maxScan: 8,
  },
  {
    field: "shotsOnTarget",
    category: "sot",
    label: (n, t) => `${n} ${t}+ Shots on Target`,
    maxScan: 5,
  },
  {
    field: "foulsCommitted",
    category: "fouls",
    label: (n, t) => `${n} ${t}+ Fouls Committed`,
    maxScan: 5,
  },
  {
    field: "foulsWon",
    category: "foulsWon",
    label: (n, t) => `${n} ${t}+ Fouls Won`,
    maxScan: 5,
  },
  {
    field: "tackles",
    category: "tackles",
    label: (n, t) => `${n} ${t}+ Tackles`,
    maxScan: 5,
  },
];

export function isConcreteTeam(name: string): boolean {
  return name.trim().length > 0 && !PLACEHOLDER_TEAM.test(name);
}

export function remainingTeams(fixtures: FixtureSummary[]): string[] {
  const teams = new Set<string>();
  for (const fx of fixtures) {
    if (isConcreteTeam(fx.home)) teams.add(fx.home);
    if (isConcreteTeam(fx.away)) teams.add(fx.away);
  }
  return [...teams].sort((a, b) => a.localeCompare(b));
}

function nextFixtureForTeam(
  teamName: string,
  fixtures: FixtureSummary[]
): FixtureSummary | null {
  const key = normTeamKey(teamName);
  const sorted = [...fixtures].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  for (const fx of sorted) {
    if (isConcreteTeam(fx.home) && normTeamKey(fx.home) === key) return fx;
    if (isConcreteTeam(fx.away) && normTeamKey(fx.away) === key) return fx;
  }
  return null;
}


function findPerfectTeamProps(
  teamName: string,
  history: TeamMatchLine[]
): TeamModelPerfectProp[] {
  const sample = history.length;
  if (sample < MIN_GAMES) return [];

  const out: TeamModelPerfectProp[] = [];

  for (const tpl of TEAM_STAT_TEMPLATES) {
    const values = history.map((l) => l[tpl.field]);
    let best = 0;
    for (let n = 1; n <= tpl.maxScan; n++) {
      if (values.every((v) => v >= n)) best = n;
      else break;
    }
    if (best < 1) continue;

    out.push({
      kind: "team",
      label: tpl.label(teamName, best),
      market: tpl.label(teamName, best),
      category: "team",
      hits: sample,
      sample,
      teamMarket: tpl.teamMarket(best) ?? undefined,
      threshold: best,
      games: history.map((l) => ({
        matchId: l.matchId,
        opponent: l.opponent,
        value: l[tpl.field],
      })),
    });
  }

  return out;
}

function findPerfectPlayerProps(
  teamName: string,
  players: PlayerTournamentStats[]
): TeamModelPerfectProp[] {
  const key = normTeamKey(teamName);
  const squad = players.filter((p) => normTeamKey(p.teamName) === key);
  const out: TeamModelPerfectProp[] = [];

  for (const player of squad) {
    const active = player.lines.filter((l) => l.minutes > 0);
    if (active.length < MIN_GAMES) continue;

    for (const tpl of PLAYER_STAT_TEMPLATES) {
      let best = 0;
      for (let n = 1; n <= tpl.maxScan; n++) {
        if (active.every((l) => l[tpl.field] >= n)) best = n;
        else break;
      }
      if (best < 1) continue;

      out.push({
        kind: "player",
        label: tpl.label(player.name, best),
        market: tpl.label(player.name, best),
        category: tpl.category,
        hits: active.length,
        sample: active.length,
        playerName: player.name,
        threshold: best,
        games: active.map((l) => ({
          matchId: l.matchId,
          opponent: l.opponent,
          value: l[tpl.field],
        })),
      });
    }
  }

  return out.sort(
    (a, b) => b.sample - a.sample || a.label.localeCompare(b.label)
  );
}

function mkTeamModelLeg(
  prop: TeamModelPerfectProp,
  teamName: string,
  matchLabel: string,
  matchId: number,
  kickoff: string,
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): BuilderLeg | null {
  if (!liveOdds) return null;

  if (prop.kind === "team" && prop.teamMarket) {
    const quote = findTeamLiveQuote(
      liveOdds,
      matchId,
      teamName,
      prop.teamMarket
    );
    if (!quote) return null;
    const priced = priceFromBet365Live(quote.price);
    return {
      type: "team",
      label: prop.label,
      market: prop.market,
      matchLabel,
      matchId,
      kickoff,
      teamName,
      category: "team",
      hitRate: 1,
      sample: prop.sample,
      tournamentHits: prop.hits,
      tournamentSample: prop.sample,
      id: `${matchId}-model-team-${prop.teamMarket}`.slice(0, 80),
      ...priced,
      bet365Link: quote.link,
      bet365SelectionId: quote.selectionId,
      bet365EventUrl: eventUrls?.get(matchId),
    };
  }

  if (prop.kind === "player" && prop.playerName) {
    const quote = findLiveQuote(
      liveOdds,
      matchId,
      prop.playerName,
      prop.category,
      prop.threshold
    );
    if (!quote) return null;
    const priced = priceFromBet365Live(quote.price);
    return {
      type: "player",
      label: prop.label,
      market: prop.market,
      matchLabel,
      matchId,
      kickoff,
      playerName: prop.playerName,
      teamName,
      category: prop.category,
      hitRate: 1,
      sample: prop.sample,
      tournamentHits: prop.hits,
      tournamentSample: prop.sample,
      id: `${matchId}-model-${normPlayer(prop.playerName)}-${prop.category}-${prop.threshold}`
        .replace(/\s+/g, "-")
        .slice(0, 80),
      ...priced,
      bet365Link: quote.link,
      bet365SelectionId: quote.selectionId,
      bet365EventUrl: eventUrls?.get(matchId),
    };
  }

  return null;
}

function oddsDistance(decimal: number): number {
  if (decimal < TARGET_DECIMAL_MIN) return 100 + (TARGET_DECIMAL_MIN - decimal);
  if (decimal <= TARGET_DECIMAL_IDEAL) return Math.abs(decimal - 2.45);
  return (decimal - TARGET_DECIMAL_IDEAL) * 0.5;
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

function buildModelSlip(
  legs: BuilderLeg[],
  teamName: string,
  matchLabel: string
): BuilderSlip | null {
  if (legs.length < MIN_LEGS) return null;

  const pool = [...legs].sort(
    (a, b) => b.decimalOdds - a.decimalOdds || b.sample - a.sample
  );
  const maxSize = Math.min(MAX_LEGS, pool.length);
  let best: BuilderLeg[] | null = null;
  let bestProb = 0;
  let bestDist = Infinity;

  for (let size = MIN_LEGS; size <= maxSize; size++) {
    for (const combo of combinations(pool, size)) {
      const decimal = combineOdds(combo);
      if (decimal < TARGET_DECIMAL_MIN) continue;
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

  if (!best) {
    const greedy: BuilderLeg[] = [];
    for (const leg of pool) {
      greedy.push(leg);
      if (
        greedy.length >= MIN_LEGS &&
        combineOdds(greedy) >= TARGET_DECIMAL_MIN
      ) {
        best = [...greedy];
        break;
      }
    }
  }

  if (!best || best.length < MIN_LEGS) return null;

  const decimal = combineOdds(best);
  const targetLabel =
    decimal >= TARGET_DECIMAL_IDEAL
      ? `2/1+ · ${matchLabel}`
      : `Evens+ · ${matchLabel}`;

  return slipFromLegs(
    `team-model-${normTeamKey(teamName)}`,
    `Team Model — ${teamName}`,
    best,
    targetLabel
  );
}

export function buildTeamModelEntry(
  teamName: string,
  teamHistory: TeamMatchLine[],
  players: PlayerTournamentStats[],
  fixtures: FixtureSummary[],
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): TeamModelEntry {
  const key = normTeamKey(teamName);
  const history = teamHistory.filter((l) => normTeamKey(l.teamName) === key);
  const next = nextFixtureForTeam(teamName, fixtures);
  const matchLabel = next ? `${next.home} v ${next.away}` : null;
  const nextOpponent =
    next && matchLabel
      ? normTeamKey(next.home) === key
        ? next.away
        : next.home
      : null;

  const perfectProps = [
    ...findPerfectTeamProps(teamName, history),
    ...findPerfectPlayerProps(teamName, players),
  ].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "team" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  const pricedLegs: BuilderLeg[] = [];
  if (next && matchLabel) {
    for (const prop of perfectProps) {
      const leg = mkTeamModelLeg(
        prop,
        teamName,
        matchLabel,
        next.id,
        next.kickoff,
        liveOdds,
        eventUrls
      );
      if (leg) pricedLegs.push(leg);
    }
  }

  const slip =
    next && matchLabel
      ? buildModelSlip(pricedLegs, teamName, matchLabel)
      : null;

  return {
    teamName,
    teamKey: key,
    gamesPlayed: history.length,
    nextMatchId: next?.id ?? null,
    nextMatchLabel: matchLabel,
    nextKickoff: next?.kickoff ?? null,
    nextOpponent,
    perfectProps,
    pricedLegs: pricedLegs.length,
    slip,
    history,
  };
}

export function buildTeamModelPayload(
  teamHistory: Map<string, TeamMatchLine[]>,
  players: PlayerTournamentStats[],
  fixtures: FixtureSummary[],
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): TeamModelPayload {
  const teams = remainingTeams(fixtures).map((teamName) => {
    const key = normTeamKey(teamName);
    const history = teamHistory.get(key) ?? [];
    return buildTeamModelEntry(
      teamName,
      history,
      players,
      fixtures,
      liveOdds,
      eventUrls
    );
  });

  teams.sort(
    (a, b) =>
      b.perfectProps.length - a.perfectProps.length ||
      b.gamesPlayed - a.gamesPlayed ||
      a.teamName.localeCompare(b.teamName)
  );

  return {
    teams,
    generatedAt: new Date().toISOString(),
  };
}
