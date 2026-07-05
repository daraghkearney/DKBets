import { toFractional } from "@/lib/format";
import {
  combineOdds,
  combineProbability,
  effectiveHitRate,
  priceFromBet365Live,
} from "./odds";
import { findLiveQuote, normPlayer } from "./bet365";
import type { Bet365LiveMap } from "./bet365-live";
import type { BuilderLeg, LegCategory } from "./types";
import type { MatchDetailPayload, PickStat, PlayerTournamentStats } from "@/lib/stats/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TeamMatchLine {
  matchId: number;
  teamName: string;
  opponent: string;
  shots: number;
  shotsOnTarget: number;
  fouls: number;
  yellowCards: number;
}

function parseNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(/[^\d.]/g, "")) || 0;
  return 0;
}

/** Extract home/away team stat pairs from FotMob match stats (All period). */
export function parseTeamMatchLines(
  matchId: number,
  payload: any,
  homeName: string,
  awayName: string
): TeamMatchLine[] {
  const sections = payload?.content?.stats?.Periods?.All?.stats ?? [];
  const pairs: Record<string, [number, number]> = {};

  for (const section of sections) {
    for (const row of section?.stats ?? []) {
      if (!row || typeof row !== "object" || !Array.isArray(row.stats)) continue;
      const key = row.key ?? row.title;
      if (typeof key !== "string") continue;
      pairs[key] = [parseNum(row.stats[0]), parseNum(row.stats[1])];
    }
  }

  const shots = pairs.total_shots ?? [0, 0];
  const sot = pairs.ShotsOnTarget ?? [0, 0];
  const fouls = pairs.fouls ?? [0, 0];
  const yc = pairs.yellow_cards ?? [0, 0];

  return [
    {
      matchId,
      teamName: homeName,
      opponent: awayName,
      shots: shots[0],
      shotsOnTarget: sot[0],
      fouls: fouls[0],
      yellowCards: yc[0],
    },
    {
      matchId,
      teamName: awayName,
      opponent: homeName,
      shots: shots[1],
      shotsOnTarget: sot[1],
      fouls: fouls[1],
      yellowCards: yc[1],
    },
  ];
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
  eventUrls?: Map<number, string>
): BuilderLeg | null {
  const market = pick.label;
  return mkLeg(
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
    },
    liveOdds,
    eventUrls
  );
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
  eventUrls?: Map<number, string>
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
          eventUrls
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
