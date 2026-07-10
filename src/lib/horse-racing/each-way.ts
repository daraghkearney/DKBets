import type { EachWayGem, HorseRace, HorseRunner } from "./types";

function placeNoteScore(runner: HorseRunner): number {
  let s = 0;
  if (runner.recentFormScore >= 0.65) s += 0.25;
  if (runner.courseFitScore >= 0.68) s += 0.12;
  if (runner.distanceFitScore >= 0.68) s += 0.12;
  if (runner.courseWinner) s += 0.08;
  if (runner.distanceWinner) s += 0.08;
  for (const n of runner.notes) {
    if (/top-3|places? at|placed/i.test(n)) s += 0.15;
    if (/course winner|distance winner/i.test(n)) s += 0.06;
  }
  if ((runner.rpr ?? 0) >= 100) s += 0.1;
  return s;
}

/** Best each-way value runner — competitive profile at a price worth backing EW. */
export function pickEachWayGem(race: HorseRace): EachWayGem | null {
  const runners = race.runners.filter((r) => r.name.length >= 2);
  if (runners.length < 5) return null;

  const sorted = [...runners].sort((a, b) => b.overallScore - a.overallScore);
  const top = sorted[0];
  let best: HorseRunner | null = null;
  let bestScore = 0;

  for (let i = 0; i < Math.min(sorted.length, 9); i++) {
    const r = sorted[i];
    const longPrice =
      r.odds != null ? r.odds >= 10 : r.marketScore <= 0.48;
    if (i === 0 && !longPrice) continue;
    let score = placeNoteScore(r);

    if (r.overallScore >= top.overallScore * 0.86) score += 0.22;
    else if (r.overallScore >= top.overallScore * 0.78) score += 0.1;

    if (r.odds != null) {
      if (r.odds >= 20) score += 0.35;
      else if (r.odds >= 12) score += 0.28;
      else if (r.odds >= 8) score += 0.2;
      else if (r.odds >= 5) score += 0.08;
      else if (r.odds < 4) score -= 0.35;
    } else if (r.marketScore <= 0.47) {
      score += 0.18;
    }

    if ((r.tipCount ?? 0) > 0) score += 0.08;
    if (r.tipsterScore >= 0.65) score += 0.1;

    if (i === 1 && (r.odds ?? 99) < 5.5 && i > 0) score -= 0.12;

    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  if (!best || bestScore < 0.42) return null;

  const parts: string[] = [];
  if (best.odds != null && best.odds >= 8) {
    parts.push(`${best.odds.toFixed(0)}/1 each-way value`);
  } else if (best.marketScore <= 0.47) {
    parts.push("Likely double-figure price");
  }
  if (best.recentFormScore >= 0.6) {
    parts.push("Strong place profile");
  }
  if (best.notes.some((n) => /top-3|places?/i.test(n))) {
    parts.push("Regularly placed at this trip");
  }
  if ((best.rpr ?? 0) >= 100) {
    parts.push(`RPR ${best.rpr}`);
  }
  if (!parts.length) {
    parts.push("Competitive form without needing to win");
  }

  return {
    runnerId: best.id,
    name: best.name,
    odds: best.odds,
    rationale: parts.join(" · "),
  };
}
