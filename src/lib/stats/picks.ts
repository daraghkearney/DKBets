import type {
  MatchupHistoryRow,
  PickStat,
  PlayerMatchLine,
  PlayerTournamentStats,
} from "./types";

interface PickTemplate {
  label: (a: string, b: string) => string;
  /** Evaluate from player A's perspective in a shared match */
  testA: (line: PlayerMatchLine) => boolean;
  testB: (line: PlayerMatchLine) => boolean;
  /** Which player the pick is "on" */
  focus: "a" | "b";
  /** Both players must satisfy their test (e.g. foul duel) */
  dual?: boolean;
}

const TEMPLATES: PickTemplate[] = [
  {
    label: (a) => `${a} 1+ fouls committed`,
    testA: (l) => l.foulsCommitted >= 1,
    testB: () => false,
    focus: "a",
  },
  {
    label: (_, b) => `${b} 1+ fouls won`,
    testA: () => false,
    testB: (l) => l.foulsWon >= 1,
    focus: "b",
  },
  {
    label: (a, b) => `${a} fouls ${b} (both active — ${a} commits 1+)`,
    testA: (l) => l.foulsCommitted >= 1,
    testB: (l) => l.foulsWon >= 1,
    focus: "a",
    dual: true,
  },
  {
    label: (a) => `${a} 1+ shots`,
    testA: (l) => l.shots >= 1,
    testB: () => false,
    focus: "a",
  },
  {
    label: (_, b) => `${b} 1+ shots on target`,
    testA: () => false,
    testB: (l) => l.shotsOnTarget >= 1,
    focus: "b",
  },
  {
    label: (a) => `${a} 1+ tackles`,
    testA: (l) => l.tackles >= 1,
    testB: () => false,
    focus: "a",
  },
  {
    label: (_, b) => `${b} 1+ tackles`,
    testA: () => false,
    testB: (l) => l.tackles >= 1,
    focus: "b",
  },
  {
    label: (a) => `${a} to be carded (yellow+)`,
    testA: (l) => l.yellowCards + l.redCards >= 1,
    testB: () => false,
    focus: "a",
  },
  {
    label: (_, b) => `${b} to be carded (yellow+)`,
    testA: () => false,
    testB: (l) => l.yellowCards + l.redCards >= 1,
    focus: "b",
  },
];

export function buildPicks(
  aName: string,
  bName: string,
  aStats: PlayerTournamentStats | null,
  bStats: PlayerTournamentStats | null,
  history: MatchupHistoryRow[]
): PickStat[] {
  const picks: PickStat[] = [];

  for (const tpl of TEMPLATES) {
    const focusName = tpl.focus === "a" ? aName : bName;
    const focusStats = tpl.focus === "a" ? aStats : bStats;
    const focusTeam = focusStats?.teamName ?? "";

    let h2hHits = 0;
    for (const row of history) {
      const ok = tpl.dual
        ? tpl.testA(row.a) && tpl.testB(row.b)
        : tpl.focus === "a"
          ? tpl.testA(row.a)
          : tpl.testB(row.b);
      if (ok) h2hHits += 1;
    }

    const tLines = focusStats?.lines ?? [];
    let tHits = 0;
    for (const line of tLines) {
      const ok = tpl.focus === "a" ? tpl.testA(line) : tpl.testB(line);
      if (ok) tHits += 1;
    }

    const h2hSample = history.length;
    const tSample = tLines.length;
    const sample = h2hSample + tSample;
    if (sample === 0) continue;

    // Weight career H2H heavily when we have real shared-meeting data.
    const rate =
      h2hSample >= 2
        ? h2hHits / h2hSample * 0.75 +
          (tSample > 0 ? (tHits / tSample) * 0.25 : 0)
        : (h2hHits + tHits) / sample;
    if (rate < 0.45) continue;

    picks.push({
      label: tpl.label(aName, bName),
      playerId: focusStats?.playerId ?? 0,
      playerName: focusStats?.name ?? focusName,
      teamName: focusTeam,
      h2hHits,
      h2hSample,
      tournamentHits: tHits,
      tournamentSample: tSample,
      rate,
      sample,
    });
  }

  return picks.sort((a, b) => b.rate - a.rate || b.sample - a.sample);
}

export function bestPick(picks: PickStat[]): PickStat | null {
  return picks[0] ?? null;
}

export function isBanker(p: PickStat): boolean {
  return p.sample >= 3 && p.rate >= 0.85;
}
