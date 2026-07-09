import type { HorseFormRun, HorseRunner, RacingFactorKey } from "./types";

/** Parse UK form string positions (1-9, 0=out, -/=sep, P=pulled up, etc.) */
export function parseFormPositions(form: string): number[] {
  const out: number[] = [];
  for (const ch of form.replace(/[-/]/g, "")) {
    if (ch >= "1" && ch <= "9") out.push(Number(ch));
    else if (ch === "0" || ch === "F" || ch === "P" || ch === "U") out.push(99);
  }
  return out;
}

export function distanceYards(dist: string): number {
  const m = dist.match(/(\d+)m\s*(\d+)?(?:y|f)?/i);
  if (m) return Number(m[1]) * 1760 + Number(m[2] ?? 0);
  const f = dist.match(/(\d+)f(?:\s*(\d+)y)?/i);
  if (f) return Number(f[1]) * 220 + Number(f[2] ?? 0);
  const y = dist.match(/(\d+)y/i);
  if (y) return Number(y[1]);
  return 0;
}

/**
 * Going scale: 0 = hard/fast ground → 6 = heavy.
 * UK/IRE official descriptions plus all-weather variants.
 */
export function goingScale(going: string): number | null {
  const g = going.toLowerCase().trim();
  if (!g) return null;
  if (/heavy/.test(g)) return 6;
  if (/soft.*heavy|heavy.*soft/.test(g)) return 5.5;
  if (/yielding.*soft|soft.*yielding/.test(g)) return 4.5;
  if (/^soft|soft \(/.test(g) || g === "soft") return 5;
  if (/good to soft|yielding/.test(g)) return 4;
  if (/good to firm/.test(g)) return 2;
  if (/^good|good \(/.test(g) || g === "good") return 3;
  if (/^firm/.test(g)) return 1;
  if (/hard/.test(g)) return 0;
  // All-weather: standard ≈ good; slow ≈ soft side
  if (/standard to slow/.test(g)) return 4;
  if (/standard/.test(g)) return 3;
  if (/slow/.test(g)) return 4.5;
  if (/fast/.test(g)) return 1.5;
  return null;
}

/**
 * Ground suitability — does this horse handle today's going?
 * Compares historical runs on similar ground (±1 on the scale).
 */
export function scoreGoingFit(
  runs: HorseFormRun[],
  raceGoing: string
): { score: number; notes: string[] } {
  const notes: string[] = [];
  const target = goingScale(raceGoing);
  if (target == null) return { score: 0.5, notes: ["Going unknown"] };

  const withGoing = runs
    .map((r) => ({ run: r, scale: goingScale(r.going) }))
    .filter((x): x is { run: HorseFormRun; scale: number } => x.scale != null);

  if (!withGoing.length) {
    return { score: 0.5, notes: [`Unproven on ${raceGoing}`] };
  }

  const similar = withGoing.filter((x) => Math.abs(x.scale - target) <= 1);
  if (!similar.length) {
    const nearest = withGoing.reduce((a, b) =>
      Math.abs(a.scale - target) < Math.abs(b.scale - target) ? a : b
    );
    const gap = Math.abs(nearest.scale - target);
    notes.push(
      `Never run on ground like ${raceGoing} (${withGoing.length} runs on different going)`
    );
    // Bigger gap from proven ground = bigger risk
    return { score: Math.max(0.28, 0.48 - gap * 0.05), notes };
  }

  const wins = similar.filter((x) => x.run.position === 1).length;
  const places = similar.filter((x) => x.run.position <= 3).length;
  const rate = places / similar.length;
  const winRate = wins / similar.length;
  notes.push(
    `${wins}W ${places}P from ${similar.length} runs on similar ground (${raceGoing})`
  );
  return {
    score: Math.min(0.95, 0.3 + rate * 0.45 + winRate * 0.25),
    notes,
  };
}

/** Days since last run — fitness/freshness sweet spot is ~15-60 days. */
export function scoreFreshness(runs: HorseFormRun[]): {
  score: number;
  notes: string[];
} {
  const dates = runs
    .map((r) => new Date(r.date).getTime())
    .filter((t) => Number.isFinite(t) && t > 0);
  if (!dates.length) return { score: 0.5, notes: [] };

  const last = Math.max(...dates);
  const days = Math.round((Date.now() - last) / 86_400_000);
  if (days < 0 || days > 1500) return { score: 0.5, notes: [] };

  let score: number;
  if (days <= 7) score = 0.55;
  else if (days <= 14) score = 0.72;
  else if (days <= 35) score = 0.85;
  else if (days <= 60) score = 0.75;
  else if (days <= 120) score = 0.55;
  else if (days <= 250) score = 0.42;
  else score = 0.35;

  const note =
    days > 120
      ? `${days} days off — fitness doubt`
      : `${days} days since last run`;
  return { score, notes: [note] };
}

/**
 * Market signal from SP/live odds. The market is the single strongest
 * predictor in racing (~33% SP favourite strike rate), so this is a
 * heavily weighted factor.
 */
export function scoreMarket(odds: number | null): {
  score: number;
  notes: string[];
} {
  if (odds == null || odds <= 1) return { score: 0.45, notes: [] };
  // odds 2.0 → ~0.86, 5.0 → ~0.61, 10 → ~0.43, 25 → ~0.18
  const score = Math.max(0.1, Math.min(0.95, 1.05 - Math.log(odds) / Math.log(40)));
  const notes =
    odds <= 4 ? [`Strong market support at ${odds.toFixed(1)}`] : [];
  return { score, notes };
}

/** Does historical form suggest this trip suits the horse? */
export function scoreDistanceFit(
  runs: HorseFormRun[],
  targetYards: number
): { score: number; notes: string[] } {
  const notes: string[] = [];
  if (!runs.length || !targetYards) return { score: 0.5, notes: ["No form for distance analysis"] };

  const tolerance = targetYards * 0.12;
  const similar = runs.filter(
    (r) => Math.abs(r.distanceYards - targetYards) <= tolerance
  );
  if (!similar.length) {
    notes.push(`No runs within ${Math.round(tolerance)}y of today's trip`);
    return { score: 0.45, notes };
  }

  const good = similar.filter((r) => r.position <= 3).length;
  const rate = good / similar.length;
  notes.push(
    `${good}/${similar.length} top-3 finishes at similar distances (${Math.round(rate * 100)}%)`
  );
  return { score: Math.min(0.95, 0.35 + rate * 0.6), notes };
}

/** Course-specific form at today's venue */
export function scoreCourseFit(
  runs: HorseFormRun[],
  course: string
): { score: number; notes: string[] } {
  const notes: string[] = [];
  const atCourse = runs.filter(
    (r) => r.course.toLowerCase() === course.toLowerCase()
  );
  if (!atCourse.length) {
    notes.push(`No previous runs at ${course}`);
    return { score: 0.5, notes };
  }
  const wins = atCourse.filter((r) => r.position === 1).length;
  const places = atCourse.filter((r) => r.position <= 3).length;
  notes.push(
    `${wins} win${wins === 1 ? "" : "s"}, ${places} place${places === 1 ? "" : "s"} at ${course}`
  );
  const rate = places / atCourse.length;
  return { score: Math.min(0.95, 0.3 + rate * 0.65), notes };
}

/** Recent form trend from last 5 runs */
export function scoreRecentForm(runs: HorseFormRun[]): {
  score: number;
  notes: string[];
} {
  const notes: string[] = [];
  const recent = runs.slice(0, 5);
  if (!recent.length) return { score: 0.5, notes: ["No recent form"] };

  const positions = recent.map((r) => r.position);
  const avg =
    positions.reduce((a, b) => a + Math.min(b, 10), 0) / positions.length;
  const top3 = positions.filter((p) => p <= 3).length;
  const lastTimeOut = positions[0];
  notes.push(
    `Last ${recent.length}: avg finish ${avg.toFixed(1)}, ${top3} top-3`
  );
  let score = Math.max(0.2, Math.min(0.95, 1 - (avg - 1) / 9));
  // Last-time-out winners carry momentum
  if (lastTimeOut === 1) {
    score = Math.min(0.95, score + 0.08);
    notes.push("Won last time out");
  }
  return { score, notes };
}

/**
 * Default factor weights. Market leads (best single predictor),
 * then recent form and ground conditions. Replaced daily by weights
 * learned from actual results (see results-learning.ts).
 */
export const DEFAULT_FACTOR_WEIGHTS: Record<RacingFactorKey, number> = {
  market: 0.28,
  form: 0.17,
  going: 0.14,
  distance: 0.13,
  course: 0.09,
  freshness: 0.08,
  tipster: 0.11,
};

export function factorScores(
  runner: HorseRunner
): Record<RacingFactorKey, number> {
  return {
    market: runner.marketScore,
    form: runner.recentFormScore,
    going: runner.goingFitScore,
    distance: runner.distanceFitScore,
    course: runner.courseFitScore,
    freshness: runner.freshnessScore,
    tipster: runner.tipsterScore,
  };
}

export function computeOverall(
  runner: HorseRunner,
  weights: Record<RacingFactorKey, number> = DEFAULT_FACTOR_WEIGHTS
): number {
  const scores = factorScores(runner);
  let total = 0;
  let weightSum = 0;
  for (const key of Object.keys(weights) as RacingFactorKey[]) {
    total += scores[key] * weights[key];
    weightSum += weights[key];
  }
  return weightSum > 0 ? total / weightSum : 0.5;
}

export function enrichRunner(
  runner: Omit<
    HorseRunner,
    | "distanceFitScore"
    | "courseFitScore"
    | "recentFormScore"
    | "goingFitScore"
    | "freshnessScore"
    | "marketScore"
    | "tipsterScore"
    | "overallScore"
    | "notes"
  >,
  raceCourse: string,
  raceYards: number,
  raceGoing = ""
): HorseRunner {
  const dist = scoreDistanceFit(runner.formRuns, raceYards);
  const course = scoreCourseFit(runner.formRuns, raceCourse);
  const recent = scoreRecentForm(runner.formRuns);
  const going = scoreGoingFit(runner.formRuns, raceGoing);
  const fresh = scoreFreshness(runner.formRuns);
  const market = scoreMarket(runner.odds);

  const enriched: HorseRunner = {
    ...runner,
    distanceFitScore: dist.score,
    courseFitScore: course.score,
    recentFormScore: recent.score,
    goingFitScore: going.score,
    freshnessScore: fresh.score,
    marketScore: market.score,
    tipsterScore: 0.5,
    overallScore: 0.5,
    notes: [
      ...market.notes,
      ...going.notes,
      ...dist.notes,
      ...course.notes,
      ...recent.notes,
      ...fresh.notes,
    ],
  };

  enriched.overallScore = computeOverall(enriched);
  return enriched;
}
