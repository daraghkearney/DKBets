import type { BuilderLeg } from "./types";
import type { ContextBuilderPayload, MatchContextReport } from "./context-types";

function playerInInsight(
  leg: BuilderLeg,
  names?: string[]
): boolean {
  if (!names?.length || !leg.playerName) return false;
  const norm = leg.playerName.toLowerCase();
  return names.some((n) => norm.includes(n.toLowerCase().split(" ").pop() ?? ""));
}

/** Score how well a leg is backed by precomputed match context. */
export function scoreLegContext(
  leg: BuilderLeg,
  report: MatchContextReport | undefined
): { score: number; notes: string[] } {
  if (!report) return { score: 0, notes: [] };

  const notes: string[] = [];
  let score = 0;

  for (const insight of report.insights) {
    const catMatch = insight.categories.includes(leg.category);
    const playerMatch = playerInInsight(leg, insight.playerNames);
    const duelMatch =
      leg.matchupLabel &&
      insight.matchupSlot &&
      leg.matchupLabel.includes(insight.matchupSlot);

    if (!catMatch && !playerMatch && !duelMatch) continue;

    let boost = insight.confidence * 0.35;
    if (catMatch) boost += 0.15;
    if (playerMatch) boost += 0.2;
    if (duelMatch) boost += 0.15;
    if (leg.h2hSample && leg.h2hSample >= 2) boost += 0.1;

    if (boost >= 0.35) {
      score += boost;
      if (insight.source === "web") score += 0.08;
      if (notes.length < 3) notes.push(insight.body);
    }
  }

  if (leg.h2hSample && leg.h2hSample >= 3 && leg.h2hHits) {
    const h2hRate = leg.h2hHits / leg.h2hSample;
    if (h2hRate >= 0.65) {
      score += 0.2;
      notes.push(
        `Career H2H: ${leg.h2hHits}/${leg.h2hSample} (${Math.round(h2hRate * 100)}%) in direct opponent meetings.`
      );
    }
  }

  if (leg.matchupLabel && !notes.length) {
    score += 0.12;
    notes.push(`Positional duel context: ${leg.matchupLabel}.`);
  }

  return {
    score: Math.min(1, score),
    notes: [...new Set(notes)].slice(0, 3),
  };
}

export function enrichLegsWithContext(
  legs: BuilderLeg[],
  context: ContextBuilderPayload
): BuilderLeg[] {
  return legs.map((leg) => {
    const report = context.byMatch[String(leg.matchId)];
    const { score, notes } = scoreLegContext(leg, report);
    return {
      ...leg,
      contextScore: score,
      contextNotes: notes,
      contextBacked: score >= 0.45 && notes.length > 0,
    };
  });
}

export function buildContextPayload(
  reports: MatchContextReport[]
): ContextBuilderPayload {
  const byMatch: Record<string, MatchContextReport> = {};
  for (const r of reports) {
    byMatch[String(r.matchId)] = r;
  }
  return {
    byMatch,
    matchIds: reports.map((r) => r.matchId),
  };
}
