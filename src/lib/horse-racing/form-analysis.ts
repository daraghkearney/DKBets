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

export function distanceYards(dist: string | undefined): number {
  const trimmed = (dist ?? "").trim();
  if (!trimmed) return 0;
  // Bare decimal number = furlongs (the Racing API returns e.g. "8.0")
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Math.round(Number(trimmed) * 220);
  }
  // "1m 2f 30y" style — miles/furlongs/yards each optional
  const miles = trimmed.match(/(\d+)\s*m\b/i);
  const furlongs = trimmed.match(/(\d+(?:\.\d+)?)\s*f\b/i);
  const yards = trimmed.match(/(\d+)\s*y\b/i);
  if (miles || furlongs || yards) {
    return (
      Number(miles?.[1] ?? 0) * 1760 +
      Math.round(Number(furlongs?.[1] ?? 0) * 220) +
      Number(yards?.[1] ?? 0)
    );
  }
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
 * Class/grade rank: lower = better company.
 * Grade/Group 1 → 1 … Class 7 → 7; Listed sits between 2 and 3.
 */
export function classRank(raceClass: string, pattern = ""): number | null {
  const p = pattern.toLowerCase();
  const g = p.match(/(?:grade|group)\s*(\d)/);
  if (g) return Number(g[1]);
  if (/listed/.test(p)) return 2.5;
  const c = raceClass.toLowerCase().match(/(?:class\s*)?(\d)/);
  if (c) return Number(c[1]);
  return null;
}

/**
 * Class suitability — proven at this level, dropping in class (a known
 * positive angle), or stepping up into unknown company?
 */
export function scoreClassFit(
  runs: HorseFormRun[],
  raceClass: string,
  pattern = ""
): { score: number; notes: string[] } {
  const today = classRank(raceClass, pattern);
  if (today == null) return { score: 0.5, notes: [] };

  const classified = runs
    .map((r) => ({ run: r, rank: classRank(r.raceClass ?? "", "") }))
    .filter((x): x is { run: HorseFormRun; rank: number } => x.rank != null);

  if (!classified.length) {
    return { score: 0.5, notes: ["Class profile unknown"] };
  }

  const lastRank = classified[0].rank;
  const atOrAbove = classified.filter((x) => x.rank <= today);
  const placedAbove = classified.some(
    (x) => x.rank < today && x.run.position <= 3
  );
  const placedAtLevel = classified.some(
    (x) => x.rank === today && x.run.position <= 3
  );

  // Dropping in class after competitive runs in better company
  if (lastRank < today && placedAbove) {
    return {
      score: 0.82,
      notes: [
        `Class drop — placed in ${lastRank < today - 1 ? "much " : ""}better company`,
      ],
    };
  }
  if (lastRank < today) {
    return { score: 0.66, notes: ["Dropping in class"] };
  }

  // Stepping up beyond anything tried
  const bestTried = Math.min(...classified.map((x) => x.rank));
  if (today < bestTried) {
    const wonLately = classified.slice(0, 3).some((x) => x.run.position === 1);
    return wonLately
      ? { score: 0.55, notes: ["Steps up in class after winning"] }
      : { score: 0.38, notes: ["Unproven at this level — step up in class"] };
  }

  if (placedAtLevel || placedAbove) {
    const placeRate =
      atOrAbove.filter((x) => x.run.position <= 3).length /
      Math.max(1, atOrAbove.length);
    return {
      score: Math.min(0.9, 0.5 + placeRate * 0.4),
      notes: [`Proven at this level (${Math.round(placeRate * 100)}% placed)`],
    };
  }

  return { score: 0.44, notes: ["Yet to place at this level"] };
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

/**
 * Fitness/freshness. Prefers the racecard's own days-since-last-run
 * figure; falls back to form-run dates. Sweet spot ~15-60 days.
 */
export function scoreFreshness(
  runs: HorseFormRun[],
  lastRunDays: number | null = null
): {
  score: number;
  notes: string[];
} {
  let days = lastRunDays;
  if (days == null) {
    const dates = runs
      .map((r) => new Date(r.date).getTime())
      .filter((t) => Number.isFinite(t) && t > 0);
    if (!dates.length) return { score: 0.5, notes: [] };
    days = Math.round((Date.now() - Math.max(...dates)) / 86_400_000);
  }
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
 * Official rating relative to the rest of the field. The handicapper's
 * own assessment — a strong "class within the race" signal. Computed
 * per race (needs the whole field), so it lives outside enrichRunner.
 */
export function applyRatingScores(runners: HorseRunner[]): void {
  // Prefer official ratings; fall back to Racing Post Ratings, which
  // cover far more runners (maidens/novices often have no OR yet).
  const useOr =
    runners.filter((r) => r.officialRating != null).length >= 3;
  const getRating = (r: HorseRunner): number | null =>
    useOr ? r.officialRating : (r.rpr ?? null);
  const label = useOr ? "OR" : "RPR";

  const rated = runners.filter((r) => getRating(r) != null);
  if (rated.length < 3) {
    for (const r of runners) r.ratingScore = 0.5;
    return;
  }
  const ratings = rated.map((r) => getRating(r) as number);
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = Math.max(1, max - min);
  for (const r of runners) {
    const rating = getRating(r);
    if (rating == null) {
      r.ratingScore = 0.45;
      continue;
    }
    r.ratingScore = 0.25 + ((rating - min) / span) * 0.65;
    if (rating === max) {
      r.notes.push(`Top-rated in field (${label} ${rating})`);
    }
  }
}

/** Topspeed figures relative to the field (scraped from HRN). */
export function applyTopspeedScores(runners: HorseRunner[]): void {
  const rated = runners.filter((r) => r.topspeed != null && r.topspeed > 0);
  if (rated.length < 3) {
    for (const r of runners) r.topspeedScore = 0.5;
    return;
  }
  const speeds = rated.map((r) => r.topspeed as number);
  const min = Math.min(...speeds);
  const max = Math.max(...speeds);
  const span = Math.max(1, max - min);
  for (const r of runners) {
    if (r.topspeed == null || r.topspeed <= 0) {
      r.topspeedScore = 0.45;
      continue;
    }
    r.topspeedScore = 0.25 + ((r.topspeed - min) / span) * 0.65;
    if (r.topspeed === max) {
      r.notes.push(`Top topspeed in field (${r.topspeed})`);
    }
  }
}

/**
 * Score from a published recent strike-rate percentage (e.g. the 14-day
 * trainer/jockey form shown on racecards). ~12% is par; 25%+ is hot.
 */
export function strikePctScore(pct: number): number {
  return Math.max(0.25, Math.min(0.9, 0.5 + (pct - 12) * 0.02));
}

/**
 * Default factor weights, informed by published prediction research:
 * market leads, then handicapper rating, ground match, form cycle and
 * class suitability. Replaced daily by weights learned from actual
 * results (see results-learning.ts).
 */
export const DEFAULT_FACTOR_WEIGHTS: Record<RacingFactorKey, number> = {
  market: 0.15,
  rating: 0.1,
  form: 0.1,
  going: 0.1,
  distance: 0.08,
  class: 0.08,
  trainer: 0.07,
  jockey: 0.06,
  course: 0.06,
  freshness: 0.04,
  tipster: 0.05,
  draw: 0.05,
  topspeed: 0.06,
};

export function factorScores(
  runner: HorseRunner
): Record<RacingFactorKey, number> {
  return {
    market: runner.marketScore,
    rating: runner.ratingScore,
    form: runner.recentFormScore,
    going: runner.goingFitScore,
    distance: runner.distanceFitScore,
    class: runner.classFitScore,
    trainer: runner.trainerScore,
    jockey: runner.jockeyScore,
    course: runner.courseFitScore,
    freshness: runner.freshnessScore,
    tipster: runner.tipsterScore,
    draw: runner.drawScore,
    topspeed: runner.topspeedScore,
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

export interface EnrichContext {
  course: string;
  distanceYards: number;
  going?: string;
  raceClass?: string;
  pattern?: string;
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
    | "classFitScore"
    | "ratingScore"
    | "trainerScore"
    | "jockeyScore"
    | "drawScore"
    | "topspeedScore"
    | "overallScore"
    | "notes"
  >,
  ctx: EnrichContext
): HorseRunner {
  const dist = scoreDistanceFit(runner.formRuns, ctx.distanceYards);
  const course = scoreCourseFit(runner.formRuns, ctx.course);
  const recent = scoreRecentForm(runner.formRuns);
  const going = scoreGoingFit(runner.formRuns, ctx.going ?? "");
  const fresh = scoreFreshness(runner.formRuns, runner.lastRunDays);
  const market = scoreMarket(runner.odds);
  const cls = scoreClassFit(
    runner.formRuns,
    ctx.raceClass ?? "",
    ctx.pattern ?? ""
  );

  const notes = [
    ...market.notes,
    ...going.notes,
    ...cls.notes,
    ...dist.notes,
    ...course.notes,
    ...recent.notes,
    ...fresh.notes,
  ];
  if (runner.headgear && /^(b|v|h|t)1?$/i.test(runner.headgear.trim())) {
    notes.push(`Headgear: ${runner.headgear}`);
  }

  const enriched: HorseRunner = {
    ...runner,
    distanceFitScore: dist.score,
    courseFitScore: course.score,
    recentFormScore: recent.score,
    goingFitScore: going.score,
    freshnessScore: fresh.score,
    marketScore: market.score,
    classFitScore: cls.score,
    // Field-relative and archive-based factors are filled by applyModel
    ratingScore: 0.5,
    trainerScore: 0.5,
    jockeyScore: 0.5,
    tipsterScore: 0.5,
    drawScore: 0.5,
    topspeedScore: 0.5,
    overallScore: 0.5,
    notes,
  };

  enriched.overallScore = computeOverall(enriched);
  return enriched;
}
