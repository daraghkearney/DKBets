/**
 * Results learning loop.
 *
 * Every export we (a) log today's predictions (per-runner factor scores),
 * and (b) review yesterday's actual results against yesterday's logged
 * predictions. For each winner we measure which factors would have found
 * it (its edge over the field per factor), then nudge the model weights
 * toward the factors that actually produced winners. Weights accumulate
 * over days via an exponential moving average, so the model keeps
 * learning from every completed race day.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  DEFAULT_FACTOR_WEIGHTS,
  factorScores,
  scoreCourseFit,
  scoreDistanceFit,
  scoreFreshness,
  scoreGoingFit,
  scoreMarket,
  scoreRecentForm,
} from "./form-analysis";
import { normalizeHorseName } from "./model";
import {
  ingestResults,
  loadPeopleStats,
  savePeopleStats,
} from "./people-stats";
import {
  fetchHorseHistory,
  fetchResultsForDate,
  isRacingApiConfigured,
  type ResultRace,
} from "./racing-api";
import { addDays, courseSlug, to24hTime, toIsoDate, ukToday } from "./dates";
import type {
  HorseRace,
  RacingFactorKey,
  RacingModelInfo,
  RacingWinnerReview,
  RacingWinnerReviewRace,
} from "./types";

const MODEL_DIR = path.join(process.cwd(), ".cache", "racing-model");
const PREDICTIONS_DIR = path.join(process.cwd(), ".cache", "racing-predictions");

const FACTOR_KEYS = Object.keys(
  DEFAULT_FACTOR_WEIGHTS
) as RacingFactorKey[];

export const FACTOR_LABELS: Record<RacingFactorKey, string> = {
  market: "Market support",
  rating: "Official rating",
  form: "Recent form",
  going: "Ground suitability",
  distance: "Trip suitability",
  class: "Class suitability",
  trainer: "Trainer strike rate",
  jockey: "Jockey strike rate",
  course: "Course form",
  freshness: "Fitness/freshness",
  tipster: "Tipster backing",
};

interface PredictionLogRunner {
  id: string;
  name: string;
  odds: number | null;
  factors: Record<RacingFactorKey, number>;
  overall: number;
  rank: number;
}

interface PredictionLogRace {
  raceId: string;
  date: string;
  course: string;
  time: string;
  name: string;
  runners: PredictionLogRunner[];
}

interface PredictionLog {
  date: string;
  savedAt: string;
  races: PredictionLogRace[];
}

// ---------------------------------------------------------------- persistence

export async function loadModel(): Promise<RacingModelInfo> {
  try {
    const raw = await readFile(path.join(MODEL_DIR, "weights.json"), "utf8");
    const data = JSON.parse(raw) as RacingModelInfo;
    if (data.weights && FACTOR_KEYS.every((k) => typeof data.weights[k] === "number")) {
      return data;
    }
  } catch {
    // fall through to defaults
  }
  return {
    weights: { ...DEFAULT_FACTOR_WEIGHTS },
    samples: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function saveModel(model: RacingModelInfo): Promise<void> {
  await mkdir(MODEL_DIR, { recursive: true });
  await writeFile(
    path.join(MODEL_DIR, "weights.json"),
    JSON.stringify(model, null, 2),
    "utf8"
  );
}

async function saveReview(review: RacingWinnerReview): Promise<void> {
  await mkdir(MODEL_DIR, { recursive: true });
  await writeFile(
    path.join(MODEL_DIR, "review.json"),
    JSON.stringify(review),
    "utf8"
  );
}

async function loadReview(date: string): Promise<RacingWinnerReview | undefined> {
  try {
    const raw = await readFile(path.join(MODEL_DIR, "review.json"), "utf8");
    const review = JSON.parse(raw) as RacingWinnerReview;
    return review.date === date ? review : undefined;
  } catch {
    return undefined;
  }
}

/** Last saved review — kept visible when today's learning pass fails. */
async function loadLatestReview(): Promise<RacingWinnerReview | undefined> {
  try {
    const raw = await readFile(path.join(MODEL_DIR, "review.json"), "utf8");
    const review = JSON.parse(raw) as RacingWinnerReview;
    return review?.date ? review : undefined;
  } catch {
    return undefined;
  }
}

async function resolveReview(
  preferredDate: string,
  fresh?: RacingWinnerReview
): Promise<RacingWinnerReview | undefined> {
  if (fresh) return fresh;
  return (await loadReview(preferredDate)) ?? (await loadLatestReview());
}

export async function savePredictionLog(
  date: string,
  races: HorseRace[]
): Promise<void> {
  const log: PredictionLog = {
    date,
    savedAt: new Date().toISOString(),
    races: races
      .filter((r) => r.runners.length)
      .map((race) => ({
        raceId: race.id,
        date,
        course: race.course,
        time: race.time,
        name: race.name,
        runners: race.runners.map((r) => ({
          id: r.id,
          name: r.name,
          odds: r.odds,
          factors: factorScores(r),
          overall: r.overallScore,
          rank: r.predictedRank ?? 0,
        })),
      })),
  };
  await mkdir(PREDICTIONS_DIR, { recursive: true });
  await writeFile(
    path.join(PREDICTIONS_DIR, `${date}.json`),
    JSON.stringify(log),
    "utf8"
  );
}

async function loadPredictionLog(date: string): Promise<PredictionLog | null> {
  try {
    const raw = await readFile(
      path.join(PREDICTIONS_DIR, `${date}.json`),
      "utf8"
    );
    return JSON.parse(raw) as PredictionLog;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ learning

function mean(values: number[]): number {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
}

function normalizeWeights(
  raw: Record<RacingFactorKey, number>
): Record<RacingFactorKey, number> {
  const total = FACTOR_KEYS.reduce((a, k) => a + Math.max(0.01, raw[k]), 0);
  const out = {} as Record<RacingFactorKey, number>;
  for (const k of FACTOR_KEYS) {
    out[k] = Math.max(0.01, raw[k]) / total;
  }
  return out;
}

/** Market score of the winner ranked against the whole field's SPs. */
function marketEdgeFromResult(race: ResultRace): number | null {
  const winner = race.runners.find((r) => r.position === 1);
  if (!winner?.sp) return null;
  const sps = race.runners
    .map((r) => r.sp)
    .filter((s): s is number => s != null);
  if (sps.length < 3) return null;
  const winnerScore = scoreMarket(winner.sp).score;
  const fieldMean = mean(sps.map((s) => scoreMarket(s).score));
  return winnerScore - fieldMean;
}

interface RaceLearning {
  edges: Partial<Record<RacingFactorKey, number>>;
  review: RacingWinnerReviewRace;
}

/** Learn from one race when we logged predictions for it. */
function learnFromLoggedRace(
  result: ResultRace,
  logged: PredictionLogRace
): RaceLearning | null {
  const winner = result.runners.find((r) => r.position === 1);
  if (!winner) return null;

  const winnerNorm = normalizeHorseName(winner.name);
  const loggedWinner = logged.runners.find(
    (r) =>
      r.id === winner.horseId || normalizeHorseName(r.name) === winnerNorm
  );
  if (!loggedWinner) return null;

  const edges: Partial<Record<RacingFactorKey, number>> = {};
  const winningFactors: RacingFactorKey[] = [];
  for (const key of FACTOR_KEYS) {
    const fieldMean = mean(logged.runners.map((r) => r.factors[key] ?? 0.5));
    const edge = (loggedWinner.factors[key] ?? 0.5) - fieldMean;
    edges[key] = edge;
    if (edge >= 0.04) winningFactors.push(key);
  }
  winningFactors.sort((a, b) => (edges[b] ?? 0) - (edges[a] ?? 0));

  return {
    edges,
    review: {
      raceId: result.raceId,
      course: result.course,
      time: result.time,
      name: result.name,
      winner: winner.name,
      winnerSp: winner.sp ?? undefined,
      ourRank: loggedWinner.rank || undefined,
      fieldSize: logged.runners.length,
      winningFactors: winningFactors.slice(0, 4),
    },
  };
}

/**
 * Learn from one race without a prediction log (first run / new day):
 * fetch the winner's pre-race history and score it against the race
 * conditions vs a neutral 0.5 baseline; market edge from the full field.
 */
async function learnFromColdRace(
  result: ResultRace
): Promise<RaceLearning | null> {
  const winner = result.runners.find((r) => r.position === 1);
  if (!winner) return null;

  const edges: Partial<Record<RacingFactorKey, number>> = {};
  const marketEdge = marketEdgeFromResult(result);
  if (marketEdge != null) edges.market = marketEdge;

  if (winner.horseId) {
    const history = (await fetchHorseHistory(winner.horseId)).filter(
      (run) => !run.date.startsWith(result.date)
    );
    if (history.length) {
      edges.going = scoreGoingFit(history, result.going).score - 0.5;
      edges.distance =
        scoreDistanceFit(history, result.distanceYards).score - 0.5;
      edges.course = scoreCourseFit(history, result.course).score - 0.5;
      edges.form = scoreRecentForm(history).score - 0.5;
      edges.freshness = scoreFreshness(history).score - 0.5;
    }
    await new Promise((r) => setTimeout(r, 520));
  }

  if (!Object.keys(edges).length) return null;

  const winningFactors = (Object.keys(edges) as RacingFactorKey[])
    .filter((k) => (edges[k] ?? 0) >= 0.06)
    .sort((a, b) => (edges[b] ?? 0) - (edges[a] ?? 0));

  return {
    edges,
    review: {
      raceId: result.raceId,
      course: result.course,
      time: result.time,
      name: result.name,
      winner: winner.name,
      winnerSp: winner.sp ?? undefined,
      fieldSize: result.runners.length,
      winningFactors: winningFactors.slice(0, 4),
    },
  };
}

function updateWeights(
  model: RacingModelInfo,
  learnings: RaceLearning[]
): RacingModelInfo {
  if (!learnings.length) return model;

  // Average per-factor edge across yesterday's races
  const avgEdges: Partial<Record<RacingFactorKey, number>> = {};
  for (const key of FACTOR_KEYS) {
    const vals = learnings
      .map((l) => l.edges[key])
      .filter((v): v is number => v != null);
    if (vals.length) avgEdges[key] = mean(vals);
  }

  // Target weights: amplify factors that separated winners from the field
  const target = {} as Record<RacingFactorKey, number>;
  for (const key of FACTOR_KEYS) {
    const edge = Math.max(-0.25, Math.min(0.25, avgEdges[key] ?? 0));
    target[key] = DEFAULT_FACTOR_WEIGHTS[key] * (1 + edge * 3);
  }
  const targetNorm = normalizeWeights(target);

  // EMA toward the day's target, learning rate shrinks as samples grow
  const n = learnings.length;
  const alpha = Math.min(0.4, n / (model.samples + n));
  const blended = {} as Record<RacingFactorKey, number>;
  for (const key of FACTOR_KEYS) {
    blended[key] =
      model.weights[key] * (1 - alpha) + targetNorm[key] * alpha;
  }

  return {
    weights: normalizeWeights(blended),
    samples: model.samples + n,
    updatedAt: new Date().toISOString(),
    factorEdges: avgEdges,
  };
}

const COLD_RACE_LIMIT = 15;
const STATS_SEED_DAYS = 3;

/**
 * Keep the trainer/jockey strike-rate archive current: seed it from the
 * recent past on first run, then ingest each new day of results once.
 * Returns yesterday's results if they were fetched, to avoid refetching.
 */
async function updatePeopleStatsArchive(
  yesterday: string
): Promise<ResultRace[] | null> {
  const stats = await loadPeopleStats();

  const targets: string[] = [];
  if (!stats.dates.length) {
    console.log(
      `  racing stats: empty archive — seeding from last ${STATS_SEED_DAYS} days of results`
    );
    for (let i = STATS_SEED_DAYS; i >= 2; i--) {
      targets.push(toIsoDate(addDays(ukToday(), -i)));
    }
  }
  targets.push(yesterday);

  let changed = false;
  let yesterdayResults: ResultRace[] | null = null;

  for (const date of targets) {
    const { races } = await fetchResultsForDate(date);
    if (date === yesterday) yesterdayResults = races;
    if (stats.dates.includes(date)) {
      await new Promise((r) => setTimeout(r, 200));
      continue;
    }
    if (races.length && ingestResults(stats, date, races)) {
      changed = true;
      console.log(`  racing stats: ingested ${races.length} races from ${date}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  if (changed) {
    await savePeopleStats(stats);
    console.log(
      `  racing stats: ${Object.keys(stats.trainers).length} trainers, ${Object.keys(stats.jockeys).length} jockeys tracked`
    );
  }
  return yesterdayResults;
}

/**
 * Main entry: review yesterday's results, update the model weights,
 * and return the current model plus a human-readable winners review.
 */
export async function learnFromYesterday(): Promise<{
  model: RacingModelInfo;
  review?: RacingWinnerReview;
}> {
  let model = await loadModel();
  if (!isRacingApiConfigured()) return { model };

  const yesterday = toIsoDate(addDays(ukToday(), -1));

  // Always keep the strike-rate archive current (idempotent per date)
  let results: ResultRace[] = [];
  try {
    results = (await updatePeopleStatsArchive(yesterday)) ?? [];
  } catch (e) {
    console.warn("  racing stats: archive update failed", e);
  }

  // The export runs hourly — only learn from each race day once,
  // otherwise one day's results would be counted ~24 times.
  if (model.lastLearnedDate === yesterday) {
    console.log(`  racing learn: already learned from ${yesterday} — skipping`);
    const review = await resolveReview(yesterday);
    return { model, review };
  }

  if (!results.length) {
    console.log(`  racing learn: fetching results for ${yesterday} …`);
    const fetched = await fetchResultsForDate(yesterday);
    results = fetched.races;
    if (!results.length) {
      console.warn(`  racing learn: no results — ${fetched.debug}`);
      const review = await resolveReview(yesterday);
      if (review) {
        console.log(
          `  racing learn: showing cached review from ${review.date} (no ${yesterday} results yet)`
        );
      }
      return { model, review };
    }
  }
  console.log(`  racing learn: ${results.length} completed races`);

  const log = await loadPredictionLog(yesterday);
  const learnings: RaceLearning[] = [];

  if (log?.races.length) {
    const raceKey = (course: string, time: string) =>
      `${courseSlug(course)}|${to24hTime(time)}`;
    const byId = new Map(log.races.map((r) => [r.raceId, r]));
    const byKey = new Map(
      log.races.map((r) => [raceKey(r.course, r.time), r])
    );
    for (const result of results) {
      const logged =
        byId.get(result.raceId) ??
        byKey.get(raceKey(result.course, result.time));
      if (!logged) continue;
      const learning = learnFromLoggedRace(result, logged);
      if (learning) learnings.push(learning);
    }
    console.log(
      `  racing learn: matched ${learnings.length}/${results.length} races to logged predictions`
    );
  }

  // Cold-start: no logged predictions — analyse winners directly
  if (!learnings.length) {
    console.log("  racing learn: no prediction log — analysing winners from history");
    for (const result of results.slice(0, COLD_RACE_LIMIT)) {
      const learning = await learnFromColdRace(result);
      if (learning) learnings.push(learning);
    }
  }

  if (!learnings.length) {
    console.warn(
      `  racing learn: could not analyse ${yesterday} — keeping previous review`
    );
    const review = await resolveReview(yesterday);
    return { model, review };
  }

  model = updateWeights(model, learnings);
  model.lastLearnedDate = yesterday;
  await saveModel(model);
  console.log(
    `  racing learn: weights updated from ${learnings.length} races (total samples ${model.samples})`
  );

  const correctWinners = learnings.filter(
    (l) => l.review.ourRank === 1
  ).length;
  const top3 = learnings.filter(
    (l) => l.review.ourRank != null && l.review.ourRank <= 3
  ).length;
  const ranked = learnings.filter((l) => l.review.ourRank != null).length;

  const factorCounts = new Map<RacingFactorKey, number>();
  for (const l of learnings) {
    for (const f of l.review.winningFactors) {
      factorCounts.set(f, (factorCounts.get(f) ?? 0) + 1);
    }
  }
  const topFactors = [...factorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f, c]) => `${FACTOR_LABELS[f]} (${c} winners)`);

  const summary = ranked
    ? `Predicted ${correctWinners}/${ranked} winners, ${top3}/${ranked} in our top 3. Strongest winner signals: ${topFactors.join(", ") || "none stood out"}.`
    : `Analysed ${learnings.length} winners from history. Strongest winner signals: ${topFactors.join(", ") || "none stood out"}.`;

  const review: RacingWinnerReview = {
    date: yesterday,
    races: learnings
      .map((l) => l.review)
      .sort((a, b) => a.time.localeCompare(b.time)),
    correctWinners,
    totalRaces: learnings.length,
    summary,
  };
  await saveReview(review);

  return { model, review };
}
