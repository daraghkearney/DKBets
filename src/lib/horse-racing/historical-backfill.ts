/**
 * Bulk historical learning from past results.
 *
 * Uses The Racing API (500k+ UK/IRE results back to ~2010) with ATR/HRN
 * fallbacks. Run via `npm run backfill:racing -- --days 90` or set
 * RACING_BACKFILL_DAYS on export (capped per run to protect API quota).
 *
 * Free alternative for offline CSV dumps: https://github.com/joenano/rpscrape
 * Paid datasets: https://horseracedatabase.com/ (UK since 2011)
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { addDays, toIsoDate, ukToday } from "./dates";
import { loadModel, saveModelInternal, learnFromResultBatch } from "./results-learning";
import { fetchResultsForDate } from "./racing-api";

const BACKFILL_DIR = path.join(process.cwd(), ".cache", "racing-model");
const STATE_FILE = path.join(BACKFILL_DIR, "backfill-state.json");

interface BackfillState {
  completedDates: string[];
  lastRunAt: string;
  totalRacesLearned: number;
}

async function loadState(): Promise<BackfillState> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    return JSON.parse(raw) as BackfillState;
  } catch {
    return { completedDates: [], lastRunAt: "", totalRacesLearned: 0 };
  }
}

async function saveState(state: BackfillState): Promise<void> {
  await mkdir(BACKFILL_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export interface BackfillOptions {
  days?: number;
  maxPerRun?: number;
  delayMs?: number;
}

/**
 * Backfill model weights from historical results.
 * Skips dates already processed. Returns races learned this run.
 */
export async function backfillHistoricalLearning(
  opts: BackfillOptions = {}
): Promise<{ learned: number; dates: string[]; debug: string }> {
  const days = opts.days ?? Number(process.env.RACING_BACKFILL_DAYS ?? 0);
  const maxPerRun = opts.maxPerRun ?? Number(process.env.RACING_BACKFILL_MAX_PER_RUN ?? 5);
  if (!days || days < 1) {
    return { learned: 0, dates: [], debug: "backfill disabled (RACING_BACKFILL_DAYS=0)" };
  }

  const state = await loadState();
  const yesterday = toIsoDate(addDays(ukToday(), -1));
  const targets: string[] = [];

  for (let i = days; i >= 1; i--) {
    const d = toIsoDate(addDays(ukToday(), -i));
    if (d > yesterday) continue;
    if (state.completedDates.includes(d)) continue;
    targets.push(d);
  }

  if (!targets.length) {
    return {
      learned: 0,
      dates: [],
      debug: `backfill complete (${state.completedDates.length} dates already done)`,
    };
  }

  const batch = targets.slice(0, maxPerRun);
  let totalLearned = 0;
  const delay = opts.delayMs ?? 800;

  for (const date of batch) {
    console.log(`  racing backfill: ${date} …`);
    const { races, debug } = await fetchResultsForDate(date);
    if (!races.length) {
      console.warn(`  racing backfill: no results for ${date} (${debug})`);
      state.completedDates.push(date);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    const learned = await learnFromResultBatch(date, races, { coldLimit: 25 });
    totalLearned += learned;
    state.completedDates.push(date);
    state.totalRacesLearned += learned;
    console.log(`  racing backfill: ${date} → ${learned} races learned`);
    await new Promise((r) => setTimeout(r, delay));
  }

  state.lastRunAt = new Date().toISOString();
  await saveState(state);

  return {
    learned: totalLearned,
    dates: batch,
    debug: `backfill ${batch.length} dates, ${totalLearned} races (${state.completedDates.length}/${days} done)`,
  };
}

/** One-shot deep backfill for local/CI script use. */
export async function runFullBackfill(days: number): Promise<void> {
  let total = 0;
  let idleRuns = 0;
  while (idleRuns < 2) {
    const res = await backfillHistoricalLearning({
      days,
      maxPerRun: 10,
      delayMs: 500,
    });
    if (res.debug.includes("complete") && !res.learned) {
      idleRuns++;
      break;
    }
    if (!res.learned && res.dates.length === 0) {
      idleRuns++;
      if (res.debug.includes("complete")) break;
      continue;
    }
    idleRuns = 0;
    total += res.learned;
    if (res.debug.includes("complete") && res.dates.length === 0) break;
  }
  const model = await loadModel();
  console.log(
    `  racing backfill done: ${total} races learned, model samples=${model.samples}`
  );
}
