import { toFractional } from "@/lib/format";
import {
  combineOdds,
  combineProbability,
  effectiveHitRate,
  priceFromBet365Live,
} from "./odds";
import { findLiveQuote, findTeamLiveQuote, normPlayer } from "./bet365";
import type { Bet365LiveMap } from "./bet365-live";
import type { BuilderLeg, LegCategory } from "./types";
import type { MatchDetailPayload, PickStat, PlayerTournamentStats } from "@/lib/stats/types";
import {
  normTeamKey,
  type TeamMatchLine,
} from "@/lib/stats/team-lines";

export { parseTeamMatchLines } from "@/lib/stats/team-lines";

function mkTeamLeg(
  partial: {
    market: string;
    matchLabel: string;
    matchId: number;
    kickoff: string;
    teamName: string;
    teamMarket: string;
    hitRate: number;
    sample: number;
    tournamentHits: number;
    tournamentSample: number;
  },
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): BuilderLeg | null {
  const quote = findTeamLiveQuote(
    liveOdds,
    partial.matchId,
    partial.teamName,
    partial.teamMarket
  );
  if (!quote) return null;

  const hitRate = effectiveHitRate(partial.hitRate, partial.sample);
  const priced = priceFromBet365Live(quote.price);
  return {
    type: "team",
    label: partial.market,
    market: partial.market,
    matchLabel: partial.matchLabel,
    matchId: partial.matchId,
    kickoff: partial.kickoff,
    teamName: partial.teamName,
    category: "team",
    hitRate,
    sample: partial.sample,
    tournamentHits: partial.tournamentHits,
    tournamentSample: partial.tournamentSample,
    id: `${partial.matchId}-team-${partial.teamMarket}`.slice(0, 80),
    ...priced,
    bet365Link: quote.link,
    bet365SelectionId: quote.selectionId,
    bet365EventUrl: eventUrls?.get(partial.matchId),
  };
}

function teamPropLegs(
  teamName: string,
  history: TeamMatchLine[],
  matchLabel: string,
  matchId: number,
  kickoff: string,
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): BuilderLeg[] {
  const sample = history.length;
  if (sample < 2) return [];

  const templates: Array<{
    teamMarket: string;
    market: string;
    test: (line: TeamMatchLine) => boolean;
  }> = [
    {
      teamMarket: "sot_over_05",
      market: `${teamName} 1+ Shots on Target`,
      test: (l) => l.shotsOnTarget >= 1,
    },
    {
      teamMarket: "shots_over_05",
      market: `${teamName} 1+ Shots`,
      test: (l) => l.shots >= 1,
    },
    {
      teamMarket: "corners_over_45",
      market: `${teamName} 4+ Corners`,
      test: (l) => l.corners >= 4,
    },
  ];

  const legs: BuilderLeg[] = [];
  for (const tpl of templates) {
    const hits = history.filter(tpl.test).length;
    const rate = hits / sample;
    if (rate < 0.55) continue;
    const leg = mkTeamLeg(
      {
        market: tpl.market,
        matchLabel,
        matchId,
        kickoff,
        teamName,
        teamMarket: tpl.teamMarket,
        hitRate: rate,
        sample,
        tournamentHits: hits,
        tournamentSample: sample,
      },
      liveOdds,
      eventUrls
    );
    if (leg) legs.push(leg);
  }
  return legs;
}

function mkLeg(
  partial: Omit<
    BuilderLeg,
    "decimalOdds" | "fractionalOdds" | "id" | "hitRate" | "oddsSource"
  > & {
    hitRate: number;
    sample: number;
  },
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): BuilderLeg | null {
  const quote = findLiveQuote(
    liveOdds,
    partial.matchId,
    partial.playerName,
    partial.category
  );
  if (!quote) return null;

  const hitRate = effectiveHitRate(partial.hitRate, partial.sample);
  const priced = priceFromBet365Live(quote.price);
  const { hitRate: _r, sample, ...rest } = partial;
  return {
    ...rest,
    hitRate,
    sample,
    id: `${partial.matchId}-${partial.market}`.replace(/\s+/g, "-").slice(0, 80),
    ...priced,
    bet365Link: quote.link,
    bet365SelectionId: quote.selectionId,
    bet365EventUrl: eventUrls?.get(partial.matchId),
  };
}

function pickToLeg(
  pick: PickStat,
  matchLabel: string,
  matchId: number,
  kickoff: string,
  category: LegCategory,
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>,
  matchupLabel?: string
): BuilderLeg | null {
  const market = pick.label;
  const leg = mkLeg(
    {
      type: "player",
      label: pick.label,
      market,
      matchLabel,
      matchId,
      kickoff,
      playerName: pick.playerName,
      teamName: pick.teamName,
      category,
      hitRate: pick.rate,
      sample: pick.sample,
      h2hHits: pick.h2hHits,
      h2hSample: pick.h2hSample,
      tournamentHits: pick.tournamentHits,
      tournamentSample: pick.tournamentSample,
      matchupLabel,
    },
    liveOdds,
    eventUrls
  );
  return leg;
}

function categoryFromLabel(label: string): LegCategory {
  if (label.includes("shots on target") || label.includes("SoT")) return "sot";
  if (label.includes("fouls won") || label.includes("Fouled") || label.includes("fouled"))
    return "foulsWon";
  if (label.includes("fouls") || label.includes("Foul")) return "fouls";
  if (label.includes("tackle")) return "tackles";
  if (label.includes("card")) return "cards";
  if (label.includes("shot")) return "shots";
  return "shots";
}

function playerPropLegs(
  player: PlayerTournamentStats,
  matchLabel: string,
  matchId: number,
  kickoff: string,
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>
): BuilderLeg[] {
  const legs: BuilderLeg[] = [];
  const lines = player.lines;
  if (!lines.length) return legs;

  const templates: Array<{
    cat: LegCategory;
    market: string;
    test: (l: (typeof lines)[0]) => boolean;
  }> = [
    {
      cat: "shots",
      market: `${player.name} — 1+ Shots`,
      test: (l) => l.shots >= 1,
    },
    {
      cat: "sot",
      market: `${player.name} — 1+ Shots on Target`,
      test: (l) => l.shotsOnTarget >= 1,
    },
    {
      cat: "fouls",
      market: `${player.name} — 1+ Fouls Committed`,
      test: (l) => l.foulsCommitted >= 1,
    },
    {
      cat: "foulsWon",
      market: `${player.name} — To Be Fouled (1+)`,
      test: (l) => l.foulsWon >= 1,
    },
    {
      cat: "tackles",
      market: `${player.name} — 1+ Tackles`,
      test: (l) => l.tackles >= 1,
    },
  ];

  for (const tpl of templates) {
    const hits = lines.filter(tpl.test).length;
    const sample = lines.length;
    const rate = hits / sample;
    if (sample < 2 || rate < 0.55) continue;
    const leg = mkLeg(
      {
        type: "player",
        label: tpl.market,
        market: tpl.market,
        matchLabel,
        matchId,
        kickoff,
        playerName: player.name,
        teamName: player.teamName,
        category: tpl.cat,
        hitRate: rate,
        sample,
      },
      liveOdds,
      eventUrls
    );
    if (leg) legs.push(leg);
  }
  return legs;
}

export function legsFromMatchDetail(
  detail: MatchDetailPayload,
  liveOdds?: Bet365LiveMap,
  eventUrls?: Map<number, string>,
  teamHistory?: Map<string, TeamMatchLine[]>
): BuilderLeg[] {
  const { fixture } = detail;
  const matchLabel = `${fixture.home} v ${fixture.away}`;
  const legs: BuilderLeg[] = [];
  const seen = new Set<string>();

  const add = (leg: BuilderLeg | null) => {
    if (!leg) return;
    const key = `${leg.matchId}|${normPlayer(leg.playerName ?? leg.market)}|${leg.category}`;
    if (seen.has(key)) return;
    seen.add(key);
    legs.push(leg);
  };

  for (const mu of detail.matchups) {
    for (const pick of mu.picks) {
      if (pick.sample < 2 || pick.rate < 0.6) continue;
      add(
        pickToLeg(
          pick,
          matchLabel,
          fixture.id,
          fixture.kickoff,
          categoryFromLabel(pick.label),
          liveOdds,
          eventUrls,
          `${mu.slot}: ${mu.label}`
        )
      );
    }
  }

  const players = new Map<number, PlayerTournamentStats>();
  for (const mu of detail.matchups) {
    if (mu.a.stats) players.set(mu.a.stats.playerId, mu.a.stats);
    if (mu.b.stats) players.set(mu.b.stats.playerId, mu.b.stats);
  }
  for (const p of players.values()) {
    for (const leg of playerPropLegs(
      p,
      matchLabel,
      fixture.id,
      fixture.kickoff,
      liveOdds,
      eventUrls
    )) {
      add(leg);
    }
  }

  if (teamHistory) {
    for (const teamName of [fixture.home, fixture.away]) {
      const history = teamHistory.get(normTeamKey(teamName)) ?? [];
      for (const leg of teamPropLegs(
        teamName,
        history,
        matchLabel,
        fixture.id,
        fixture.kickoff,
        liveOdds,
        eventUrls
      )) {
        add(leg);
      }
    }
  }

  return legs;
}

/** Team props excluded until live Bet365 team markets are wired. */
export function legsFromTeamHistory(): BuilderLeg[] {
  return [];
}

export function dedupeLegs(legs: BuilderLeg[]): BuilderLeg[] {
  const map = new Map<string, BuilderLeg>();
  for (const leg of legs) {
    const key = `${leg.matchId}|${normPlayer(leg.playerName ?? leg.market)}|${leg.category}`;
    const hit = map.get(key);
    if (!hit || leg.hitRate > hit.hitRate) map.set(key, leg);
  }
  return [...map.values()].sort((a, b) => b.hitRate - a.hitRate || b.sample - a.sample);
}

export function slipFromLegs(
  id: string,
  title: string,
  legs: BuilderLeg[],
  targetLabel?: string
): import("./types").BuilderSlip {
  const combinedDecimal = combineOdds(legs);
  return {
    id,
    title,
    legs,
    combinedDecimal,
    combinedFractional: toFractional(combinedDecimal),
    combinedProbability: combineProbability(legs),
    targetLabel,
  };
}
