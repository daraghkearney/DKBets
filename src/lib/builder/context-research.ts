import type { MatchDetailPayload, Matchup, PlayerMatchLine } from "@/lib/stats/types";
import {
  normTeamKey,
  type TeamMatchLine,
} from "@/lib/stats/team-lines";
import type {
  ContextInsight,
  DuelContextReport,
  DuelStatSummary,
  MatchContextReport,
  TeamTendencyReport,
} from "./context-types";
import type { LegCategory } from "./types";

function pct(hits: number, sample: number): number {
  return sample > 0 ? hits / sample : 0;
}

function teamTendencies(
  teamName: string,
  history: TeamMatchLine[]
): TeamTendencyReport | null {
  if (history.length < 2) return null;
  const n = history.length;
  const sum = history.reduce(
    (acc, l) => ({
      shots: acc.shots + l.shots,
      sot: acc.sot + l.shotsOnTarget,
      fouls: acc.fouls + l.fouls,
      corners: acc.corners + l.corners,
    }),
    { shots: 0, sot: 0, fouls: 0, corners: 0 }
  );
  return {
    teamName,
    games: n,
    avgShots: sum.shots / n,
    avgSot: sum.sot / n,
    avgFouls: sum.fouls / n,
    avgCorners: sum.corners / n,
    shotHitRate: pct(history.filter((l) => l.shots >= 1).length, n),
    sotHitRate: pct(history.filter((l) => l.shotsOnTarget >= 1).length, n),
    foulHitRate: pct(history.filter((l) => l.fouls >= 3).length, n),
  };
}

function duelStats(mu: Matchup): DuelStatSummary[] {
  const rows = mu.history;
  if (!rows.length) return [];
  const n = rows.length;
  const a = mu.a.player.name;
  const b = mu.b.player.name;

  const templates: Array<{
    label: string;
    testA: (l: PlayerMatchLine) => boolean;
    testB: (l: PlayerMatchLine) => boolean;
    categories: LegCategory[];
  }> = [
    {
      label: `${a} fouls committed`,
      testA: (l) => l.foulsCommitted >= 1,
      testB: () => false,
      categories: ["fouls"],
    },
    {
      label: `${b} fouls won`,
      testA: () => false,
      testB: (l) => l.foulsWon >= 1,
      categories: ["foulsWon"],
    },
    {
      label: `${a} 1+ shots`,
      testA: (l) => l.shots >= 1,
      testB: () => false,
      categories: ["shots"],
    },
    {
      label: `${b} 1+ shots on target`,
      testA: () => false,
      testB: (l) => l.shotsOnTarget >= 1,
      categories: ["sot"],
    },
    {
      label: `${a} 1+ tackles`,
      testA: (l) => l.tackles >= 1,
      testB: () => false,
      categories: ["tackles"],
    },
    {
      label: `${b} 1+ tackles`,
      testA: () => false,
      testB: (l) => l.tackles >= 1,
      categories: ["tackles"],
    },
  ];

  return templates
    .map((t) => {
      const aHits = rows.filter((r) => t.testA(r.a)).length;
      const bHits = rows.filter((r) => t.testB(r.b)).length;
      return {
        label: t.label,
        aHits,
        bHits,
        sample: n,
        aRate: pct(aHits, n),
        bRate: pct(bHits, n),
      };
    })
    .filter((s) => s.aRate >= 0.5 || s.bRate >= 0.5);
}

function duelNarrative(mu: Matchup, stats: DuelStatSummary[]): string {
  const n = mu.careerH2hGames || mu.history.length;
  const a = mu.a.player.name;
  const b = mu.b.player.name;
  if (n === 0) {
    return `${a} vs ${b} (${mu.slot}) — no shared meetings on record; lean on tournament form.`;
  }

  const highlights = stats
    .filter((s) => s.aRate >= 0.6 || s.bRate >= 0.6)
    .slice(0, 3)
    .map((s) => {
      if (s.bRate >= s.aRate && s.bRate >= 0.6) {
        return `${s.label} in ${Math.round(s.bRate * 100)}% of ${n} meetings`;
      }
      return `${s.label} in ${Math.round(s.aRate * 100)}% of ${n} meetings`;
    });

  const comp = mu.history[0]?.competition ?? "club/international";
  const base = `${a} vs ${b}: ${n} career meeting${n === 1 ? "" : "s"} (${comp} incl.)`;
  return highlights.length ? `${base}. ${highlights.join("; ")}.` : `${base}.`;
}

function analyzeDuel(mu: Matchup): DuelContextReport {
  const stats = duelStats(mu);
  return {
    slot: mu.slot,
    label: mu.label,
    playerA: mu.a.player.name,
    playerB: mu.b.player.name,
    careerMeetings: mu.careerH2hGames || mu.history.length,
    isRivalry: mu.isCareerRivalry,
    stats,
    narrative: duelNarrative(mu, stats),
  };
}

function formationInsight(
  home: string,
  away: string,
  homeForm: string | null,
  awayForm: string | null
): ContextInsight | null {
  if (!homeForm || !awayForm) return null;
  const wide = (f: string) => /4-3-3|4-2-3-1|3-4-3|4-1-4-1/.test(f);
  const deep = (f: string) => /5-4-1|5-3-2|4-5-1|3-5-2/.test(f);

  let body = `${home} (${homeForm}) vs ${away} (${awayForm}). `;
  const categories: LegCategory[] = ["team"];

  if (wide(homeForm) && deep(awayForm)) {
    body +=
      "Wide home shape against a low block — expect sustained home pressure, wing shots and team SOT props carry weight.";
    categories.push("shots", "sot");
  } else if (deep(homeForm) && wide(awayForm)) {
    body +=
      "Away side likely to attack space in wide areas; full-back vs winger duels and away shot volume are key angles.";
    categories.push("shots", "sot", "fouls");
  } else if (wide(homeForm) && wide(awayForm)) {
    body +=
      "Open, forward-facing shapes both sides — transitional fouls, shots and direct duels should feature heavily.";
    categories.push("shots", "fouls", "foulsWon", "tackles");
  } else {
    body +=
      "Balanced structures — midfield duels and disciplined defending may drive foul and tackle markets.";
    categories.push("fouls", "tackles");
  }

  return {
    id: `formation-${home}-${away}`,
    kind: "formation",
    title: "Formation matchup",
    body,
    confidence: 0.72,
    categories,
  };
}

function teamTendencyInsights(
  home: TeamTendencyReport | null,
  away: TeamTendencyReport | null,
  matchLabel: string
): ContextInsight[] {
  const out: ContextInsight[] = [];
  for (const t of [home, away].filter(Boolean) as TeamTendencyReport[]) {
    if (t.shotHitRate >= 0.85) {
      out.push({
        id: `team-shots-${t.teamName}`,
        kind: "team_tendency",
        title: `${t.teamName} shot volume`,
        body: `${t.teamName} have recorded 1+ shots in ${Math.round(t.shotHitRate * 100)}% of their last ${t.games} games in this sample (avg ${t.avgShots.toFixed(1)} shots). Team shot props are strongly supported.`,
        confidence: Math.min(0.92, 0.65 + t.shotHitRate * 0.25),
        categories: ["team", "shots"],
      });
    }
    if (t.sotHitRate >= 0.8) {
      out.push({
        id: `team-sot-${t.teamName}`,
        kind: "team_tendency",
        title: `${t.teamName} on target`,
        body: `${t.teamName} hit 1+ shots on target in ${Math.round(t.sotHitRate * 100)}% of recent outings (avg ${t.avgSot.toFixed(1)} SOT).`,
        confidence: Math.min(0.9, 0.6 + t.sotHitRate * 0.3),
        categories: ["team", "sot"],
      });
    }
    if (t.foulHitRate >= 0.55) {
      out.push({
        id: `team-fouls-${t.teamName}`,
        kind: "team_tendency",
        title: `${t.teamName} physicality`,
        body: `${t.teamName} commit 3+ fouls in ${Math.round(t.foulHitRate * 100)}% of games tracked — a physical, interrupt-heavy profile in ${matchLabel}.`,
        confidence: 0.68,
        categories: ["fouls", "tackles"],
      });
    }
  }
  return out;
}

function duelInsights(duels: DuelContextReport[]): ContextInsight[] {
  return duels
    .filter((d) => d.careerMeetings >= 1 && d.stats.length > 0)
    .map((d) => {
      const top = d.stats.sort(
        (a, b) => Math.max(b.aRate, b.bRate) - Math.max(a.aRate, a.bRate)
      )[0];
      const rate = Math.max(top?.aRate ?? 0, top?.bRate ?? 0);
      const categories: LegCategory[] = [];
      if (top?.label.includes("foul") && top.label.includes("committed"))
        categories.push("fouls");
      if (top?.label.includes("fouls won")) categories.push("foulsWon");
      if (top?.label.includes("shots on target")) categories.push("sot");
      else if (top?.label.includes("shots")) categories.push("shots");
      if (top?.label.includes("tackle")) categories.push("tackles");

      return {
        id: `duel-${d.playerA}-${d.playerB}`,
        kind: d.isRivalry ? "career_h2h" : "player_duel",
        title: d.isRivalry ? `Known rivalry — ${d.slot}` : d.slot,
        body: d.narrative,
        confidence: Math.min(
          0.95,
          0.55 + rate * 0.35 + Math.min(d.careerMeetings, 5) * 0.03
        ),
        categories: categories.length ? categories : ["fouls", "shots"],
        playerNames: [d.playerA, d.playerB],
        matchupSlot: d.slot,
      };
    });
}

function tournamentFormInsights(detail: MatchDetailPayload): ContextInsight[] {
  const out: ContextInsight[] = [];
  for (const mu of detail.matchups) {
    for (const side of [mu.a, mu.b]) {
      const stats = side.stats;
      if (!stats || stats.lines.length < 3) continue;
      const lines = stats.lines;
      const n = lines.length;
      const shotsRate = pct(lines.filter((l) => l.shots >= 1).length, n);
      const foulsRate = pct(lines.filter((l) => l.foulsCommitted >= 1).length, n);
      const sotRate = pct(lines.filter((l) => l.shotsOnTarget >= 1).length, n);

      if (shotsRate >= 0.85) {
        out.push({
          id: `form-shots-${stats.playerId}`,
          kind: "tournament_form",
          title: `${stats.name} shooting form`,
          body: `${stats.name} (${side.teamName}) has 1+ shots in ${Math.round(shotsRate * 100)}% of ${n} games in this sample — consistent shot volume regardless of opponent profile.`,
          confidence: 0.7 + shotsRate * 0.2,
          categories: ["shots"],
          playerNames: [stats.name],
        });
      }
      if (sotRate >= 0.75) {
        out.push({
          id: `form-sot-${stats.playerId}`,
          kind: "tournament_form",
          title: `${stats.name} accuracy`,
          body: `${stats.name} records 1+ shots on target in ${Math.round(sotRate * 100)}% of recent appearances.`,
          confidence: 0.68 + sotRate * 0.22,
          categories: ["sot"],
          playerNames: [stats.name],
        });
      }
      if (foulsRate >= 0.8) {
        out.push({
          id: `form-fouls-${stats.playerId}`,
          kind: "tournament_form",
          title: `${stats.name} foul profile`,
          body: `${stats.name} commits 1+ fouls in ${Math.round(foulsRate * 100)}% of games — a reliable foul-market profile in this tournament window.`,
          confidence: 0.65 + foulsRate * 0.25,
          categories: ["fouls"],
          playerNames: [stats.name],
        });
      }
    }
  }
  return out.slice(0, 8);
}

function tacticalEdgeInsights(detail: MatchDetailPayload): ContextInsight[] {
  const out: ContextInsight[] = [];
  for (const mu of detail.matchups) {
    if (mu.kind !== "positional") continue;
    const aBand = mu.a.player.band;
    const bBand = mu.b.player.band;
    const aStats = mu.a.stats;
    const bStats = mu.b.stats;

    if (aBand === "FW" && bBand === "DF" && aStats && bStats) {
      const aShots = aStats.per90.shots;
      const bTackles = bStats.per90.tackles;
      if (aShots >= 2.5 && bTackles >= 1.5) {
        out.push({
          id: `edge-${mu.a.player.id}-${mu.b.player.id}`,
          kind: "tactical_edge",
          title: mu.slot,
          body: `${mu.a.player.name} averages ${aShots.toFixed(1)} shots/90 while ${mu.b.player.name} averages ${bTackles.toFixed(1)} tackles/90 — a high-contact wide or central channel where fouls, tackles and shot props all correlate.`,
          confidence: 0.74,
          categories: ["shots", "fouls", "tackles", "foulsWon"],
          playerNames: [mu.a.player.name, mu.b.player.name],
          matchupSlot: mu.slot,
        });
      }
    }
  }
  return out.slice(0, 6);
}

export function buildMatchContextReport(
  detail: MatchDetailPayload,
  teamHistory?: Map<string, TeamMatchLine[]>
): MatchContextReport {
  const { fixture } = detail;
  const matchLabel = `${fixture.home} v ${fixture.away}`;

  const homeHist = teamHistory?.get(normTeamKey(fixture.home)) ?? [];
  const awayHist = teamHistory?.get(normTeamKey(fixture.away)) ?? [];
  const homeT = teamTendencies(fixture.home, homeHist);
  const awayT = teamTendencies(fixture.away, awayHist);

  const duels = detail.matchups.map(analyzeDuel);
  const rivalryCount = duels.filter((d) => d.isRivalry && d.careerMeetings >= 2).length;

  const formInsight = formationInsight(
    fixture.home,
    fixture.away,
    detail.homeFormation,
    detail.awayFormation
  );

  const insights: ContextInsight[] = [
    ...(formInsight ? [formInsight] : []),
    ...teamTendencyInsights(homeT, awayT, matchLabel),
    ...duelInsights(duels),
    ...tacticalEdgeInsights(detail),
    ...tournamentFormInsights(detail),
  ].sort((a, b) => b.confidence - a.confidence);

  const topDuel = duels
    .filter((d) => d.careerMeetings >= 2)
    .sort((a, b) => b.careerMeetings - a.careerMeetings)[0];

  let summary = `Context research for ${matchLabel}`;
  if (detail.homeFormation && detail.awayFormation) {
    summary += ` (${detail.homeFormation} vs ${detail.awayFormation})`;
  }
  summary += `. ${insights.length} supporting factors identified`;
  if (rivalryCount > 0) {
    summary += `, including ${rivalryCount} career rivalry channel${rivalryCount === 1 ? "" : "s"}`;
  }
  if (topDuel) {
    summary += `. Standout duel: ${topDuel.playerA} vs ${topDuel.playerB} (${topDuel.careerMeetings} meetings)`;
  }
  summary += ".";

  return {
    matchId: fixture.id,
    matchLabel,
    kickoff: fixture.kickoff,
    homeFormation: detail.homeFormation,
    awayFormation: detail.awayFormation,
    summary,
    insights: insights.slice(0, 14),
    duels,
    homeTendencies: homeT,
    awayTendencies: awayT,
  };
}
