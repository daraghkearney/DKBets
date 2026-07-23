import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { addDays, courseSlug, to24hTime, toIsoDate, ukToday } from "./dates";
import { EW_MIN_ODDS, ewPlacePositions } from "./each-way";
import { fetchResultsForDate } from "./racing-api";
import type { ResultRace } from "./racing-api";
import type { RacingNapPick, RacingPerformanceStats } from "./types";

const LEDGER_DIR = path.join(process.cwd(), ".cache", "racing-performance");
const LEDGER_FILE = path.join(LEDGER_DIR, "ledger.json");
const PREDICTIONS_DIR = path.join(process.cwd(), ".cache", "racing-predictions");

export interface PerformanceLedgerEntry {
  date: string;
  raceId: string;
  course: string;
  time: string;
  pick: string;
  pickOdds: number | null;
  pickProb: number | null;
  pickEdge: number | null;
  pickRank: number;
  winner: string;
  winnerSp: number | null;
  winnerRank: number | null;
  winHit: boolean;
  top3Hit: boolean;
  isNap: boolean;
  /** Cleared confident #1 gates (includes naps). */
  isConfident?: boolean;
  /** Each-way gem selection (separate ledger row from the #1 model pick) */
  isEwGem?: boolean;
  placeHit?: boolean;
}

interface LedgerFile {
  entries: PerformanceLedgerEntry[];
  updatedAt: string;
}

async function loadLedger(): Promise<LedgerFile> {
  try {
    const raw = await readFile(LEDGER_FILE, "utf8");
    const file = JSON.parse(raw) as LedgerFile;
    if (file.entries?.length) return file;
  } catch {
    // fall through to seed
  }

  try {
    const seedPath = path.join(
      process.cwd(),
      "data",
      "racing-performance-seed",
      "ledger.json"
    );
    const raw = await readFile(seedPath, "utf8");
    const seeded = JSON.parse(raw) as LedgerFile;
    if (seeded.entries?.length) {
      console.log(
        `  racing ledger: loaded seed (${seeded.entries.length} entries)`
      );
      await saveLedger(seeded);
      return seeded;
    }
  } catch {
    // fall through
  }

  return { entries: [], updatedAt: new Date().toISOString() };
}

async function saveLedger(file: LedgerFile): Promise<void> {
  await mkdir(LEDGER_DIR, { recursive: true });
  file.updatedAt = new Date().toISOString();
  await writeFile(LEDGER_FILE, JSON.stringify(file, null, 2), "utf8");
}

interface PredictionRunner {
  id: string;
  name: string;
  odds: number | null;
  overall: number;
  rank: number;
  winProbability?: number;
  modelEdge?: number;
}

interface PredictionRace {
  raceId: string;
  course: string;
  time: string;
  runners: PredictionRunner[];
  topPickConfidence?: "standard" | "confident" | "nap";
  eachWayGem?: { runnerId: string; name: string; odds: number | null };
}

interface PredictionLogFile {
  date: string;
  races: PredictionRace[];
}

async function loadPredictionLog(date: string): Promise<PredictionLogFile | null> {
  try {
    const raw = await readFile(
      path.join(PREDICTIONS_DIR, `${date}.json`),
      "utf8"
    );
    return JSON.parse(raw) as PredictionLogFile;
  } catch {
    return null;
  }
}

function runnerFinishedPosition(
  result: ResultRace,
  runnerId: string,
  name: string
): number | null {
  const norm = normaliseName(name);
  const row = result.runners.find(
    (r) =>
      (runnerId && r.horseId === runnerId) ||
      normaliseName(r.name) === norm
  );
  return row && row.position > 0 ? row.position : null;
}

function normaliseName(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

export async function saveNapLog(
  date: string,
  naps: RacingNapPick[]
): Promise<void> {
  await mkdir(LEDGER_DIR, { recursive: true });
  await writeFile(
    path.join(LEDGER_DIR, `naps-${date}.json`),
    JSON.stringify(naps.map((n) => n.raceId)),
    "utf8"
  );
}

export async function saveConfidentLog(
  date: string,
  raceIds: string[]
): Promise<void> {
  await mkdir(LEDGER_DIR, { recursive: true });
  await writeFile(
    path.join(LEDGER_DIR, `confident-${date}.json`),
    JSON.stringify([...new Set(raceIds)]),
    "utf8"
  );
}

async function loadNapRaceIds(date: string): Promise<Set<string>> {
  try {
    const raw = await readFile(
      path.join(LEDGER_DIR, `naps-${date}.json`),
      "utf8"
    );
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function loadConfidentRaceIds(date: string): Promise<Set<string>> {
  try {
    const raw = await readFile(
      path.join(LEDGER_DIR, `confident-${date}.json`),
      "utf8"
    );
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function raceKey(course: string, time: string): string {
  return `${courseSlug(course)}|${to24hTime(time)}`;
}

/** Prefer SP for settled ROI; fall back to card price only if SP missing. */
function resolvePickOdds(
  cardOdds: number | null | undefined,
  result: ResultRace,
  horseName: string
): number | null {
  const norm = normaliseName(horseName);
  const row = result.runners.find((r) => normaliseName(r.name) === norm);
  if (row?.sp != null && row.sp > 1) return row.sp;
  if (cardOdds != null && cardOdds > 1) return cardOdds;
  return null;
}

/**
 * Record outcomes for races where we logged a #1 prediction.
 */
export async function recordDayOutcomes(
  date: string,
  results: ResultRace[],
  loggedRaces: PredictionRace[],
  napRaceIds?: Set<string>,
  confidentRaceIds?: Set<string>
): Promise<void> {
  const napIds = napRaceIds ?? (await loadNapRaceIds(date));
  const confidentIds =
    confidentRaceIds ?? (await loadConfidentRaceIds(date));
  const ledger = await loadLedger();
  const existingIds = new Set(
    ledger.entries.filter((e) => e.date === date).map((e) => e.raceId)
  );
  const existingKeys = new Set(
    ledger.entries
      .filter((e) => e.date === date && !e.isEwGem)
      .map((e) => raceKey(e.course, e.time))
  );

  const byKey = new Map(loggedRaces.map((r) => [raceKey(r.course, r.time), r]));
  const byId = new Map(loggedRaces.map((r) => [r.raceId, r]));

  for (const result of results) {
    const key = raceKey(result.course, result.time);
    const logged = byId.get(result.raceId) ?? byKey.get(key);
    if (!logged) continue;
    if (existingIds.has(result.raceId) || existingKeys.has(key)) continue;

    const pick = logged.runners.find((r) => r.rank === 1);
    if (!pick) continue;

    const winner = result.runners.find((r) => r.position === 1);
    if (!winner) continue;

    const winnerNorm = normaliseName(winner.name);

    let winnerRank: number | null = null;
    for (const r of logged.runners) {
      if (normaliseName(r.name) === winnerNorm) {
        winnerRank = r.rank;
        break;
      }
    }

    const pickOdds = resolvePickOdds(pick.odds, result, pick.name);
    const pickFinish = runnerFinishedPosition(result, pick.id, pick.name);
    const isNap = napIds.has(result.raceId) || napIds.has(logged.raceId);
    const loggedConfidence = logged.topPickConfidence;
    const isConfident =
      isNap ||
      confidentIds.has(result.raceId) ||
      confidentIds.has(logged.raceId) ||
      loggedConfidence === "confident" ||
      loggedConfidence === "nap" ||
      // Backfill heuristic for days before confident logs existed
      (loggedConfidence == null &&
        pick.modelEdge != null &&
        pick.modelEdge >= 1.08);

    ledger.entries.push({
      date,
      raceId: result.raceId,
      course: result.course,
      time: result.time,
      pick: pick.name,
      pickOdds,
      pickProb: pick.winProbability ?? null,
      pickEdge: pick.modelEdge ?? null,
      pickRank: 1,
      winner: winner.name,
      winnerSp: winner.sp ?? null,
      winnerRank,
      winHit: winnerRank === 1,
      // Honest "in frame": our #1 pick finished in the top 3
      top3Hit: pickFinish != null && pickFinish <= 3,
      isNap,
      isConfident,
      isEwGem: false,
    });
    existingIds.add(result.raceId);
    existingKeys.add(key);

    const gem = logged.eachWayGem;
    if (gem?.name) {
      const ewKey = `${result.raceId}:ew`;
      if (!existingIds.has(ewKey)) {
        const fieldSize = result.runners.filter((r) => r.position > 0).length;
        const ewPos = runnerFinishedPosition(result, gem.runnerId, gem.name);
        const places = ewPlacePositions(fieldSize);
        const placeHit =
          ewPos != null && places > 0 && ewPos <= places;
        ledger.entries.push({
          date,
          raceId: ewKey,
          course: result.course,
          time: result.time,
          pick: gem.name,
          pickOdds: resolvePickOdds(gem.odds, result, gem.name),
          pickProb: null,
          pickEdge: null,
          pickRank: 0,
          winner: winner.name,
          winnerSp: winner.sp ?? null,
          winnerRank: ewPos,
          winHit: ewPos === 1,
          top3Hit: ewPos != null && ewPos <= 3,
          isNap: false,
          isEwGem: true,
          placeHit,
        });
        existingIds.add(ewKey);
      }
    }
  }

  // Keep last 120 days
  const cutoff = toIsoDate(addDays(ukToday(), -120));
  ledger.entries = ledger.entries.filter((e) => e.date >= cutoff);
  await saveLedger(ledger);
}

/**
 * Fill missing pickOdds from result SPs so flat ROI includes all settled picks.
 */
export async function enrichLedgerPickOdds(
  opts: { maxDates?: number } = {}
): Promise<{ updated: number; dates: string[] }> {
  const maxDates = opts.maxDates ?? Number(process.env.RACING_LEDGER_ENRICH_MAX ?? 5);
  const ledger = await loadLedger();
  const needByDate = new Map<string, PerformanceLedgerEntry[]>();
  for (const e of ledger.entries) {
    if (e.pickOdds != null && e.pickOdds > 1) continue;
    const list = needByDate.get(e.date) ?? [];
    list.push(e);
    needByDate.set(e.date, list);
  }

  const dates = [...needByDate.keys()].sort().reverse().slice(0, maxDates);
  let updated = 0;

  for (const date of dates) {
    const { races } = await fetchResultsForDate(date);
    if (!races.length) continue;
    const byKey = new Map(races.map((r) => [raceKey(r.course, r.time), r]));
    for (const entry of needByDate.get(date) ?? []) {
      const result = byKey.get(raceKey(entry.course, entry.time));
      if (!result) continue;
      const odds = resolvePickOdds(null, result, entry.pick);
      if (odds == null) continue;
      entry.pickOdds = odds;
      if (entry.winnerSp == null) {
        const winner = result.runners.find((r) => r.position === 1);
        if (winner?.sp) entry.winnerSp = winner.sp;
      }
      updated += 1;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (updated > 0) await saveLedger(ledger);
  return { updated, dates };
}

/**
 * Rebuild the performance ledger from saved prediction logs + results.
 * Uses the same prediction history that powered the old review panel.
 */
export async function backfillPerformanceLedger(
  opts: { windowDays?: number; maxPerRun?: number } = {}
): Promise<{ recorded: number; dates: string[] }> {
  const windowDays = opts.windowDays ?? 90;
  const maxPerRun =
    opts.maxPerRun ?? Number(process.env.RACING_LEDGER_BACKFILL_MAX ?? 14);

  let files: string[] = [];
  try {
    files = await readdir(PREDICTIONS_DIR);
  } catch {
    return { recorded: 0, dates: [] };
  }

  const ledger = await loadLedger();
  const cutoff = toIsoDate(addDays(ukToday(), -windowDays));
  const yesterday = toIsoDate(addDays(ukToday(), -1));

  const candidateDates = files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(".json", ""))
    .filter((d) => d >= cutoff && d <= yesterday)
    .sort()
    .reverse();

  const targets: string[] = [];
  for (const date of candidateDates) {
    if (targets.length >= maxPerRun) break;
    const log = await loadPredictionLog(date);
    if (!log?.races.length) continue;
    const dayPicks = ledger.entries.filter(
      (e) => e.date === date && !e.isEwGem
    ).length;
    if (dayPicks >= log.races.length) continue;
    targets.push(date);
  }
  let recorded = 0;

  for (const date of targets) {
    const log = await loadPredictionLog(date);
    if (!log?.races.length) continue;

    const { races, debug } = await fetchResultsForDate(date);
    if (!races.length) {
      console.warn(`  racing ledger backfill: no results for ${date} (${debug})`);
      continue;
    }

    const before = (await loadLedger()).entries.length;
    await recordDayOutcomes(date, races, log.races);
    const after = (await loadLedger()).entries.length;
    const added = after - before;
    recorded += added;
    console.log(
      `  racing ledger backfill: ${date} → ${added} entries (${races.length} results)`
    );
    await new Promise((r) => setTimeout(r, 600));
  }

  return { recorded, dates: targets };
}

/** Min modelEdge used only as a backfill heuristic when confident logs missing. */
const VALUE_EDGE_MIN = 1.08;

/** Strict EW gems only — drops pre-rewrite soft / short-priced / no-odds rows. */
function isStrictEwGem(e: PerformanceLedgerEntry): boolean {
  return Boolean(e.isEwGem && e.pickOdds != null && e.pickOdds >= EW_MIN_ODDS);
}

function isConfidentPick(e: PerformanceLedgerEntry): boolean {
  if (e.isEwGem) return false;
  if (e.isConfident || e.isNap) return true;
  // Historical rows before confident logging
  return e.pickEdge != null && e.pickEdge >= VALUE_EDGE_MIN;
}

export function computePerformanceStats(
  entries: PerformanceLedgerEntry[],
  windowDays = 90
): RacingPerformanceStats {
  const cutoff = toIsoDate(addDays(ukToday(), -windowDays));
  const window = entries.filter((e) => e.date >= cutoff);
  const modelPicks = window.filter((e) => !e.isEwGem);
  const ewGems = window.filter(isStrictEwGem);
  const confident = modelPicks.filter(isConfidentPick);
  const naps = modelPicks.filter((e) => e.isNap);

  const wins = modelPicks.filter((e) => e.winHit).length;
  const top3 = modelPicks.filter((e) => e.top3Hit).length;
  const napWins = naps.filter((e) => e.winHit).length;
  const confidentWins = confident.filter((e) => e.winHit).length;
  const ewPlaces = ewGems.filter((e) => e.placeHit).length;

  let roi = 0;
  let staked = 0;
  for (const e of modelPicks) {
    if (e.pickOdds == null || e.pickOdds <= 1) continue;
    staked += 1;
    if (e.winHit) roi += e.pickOdds - 1;
    else roi -= 1;
  }

  const byCourse: RacingPerformanceStats["byCourse"] = {};
  for (const e of modelPicks) {
    const c = e.course;
    if (!byCourse[c]) byCourse[c] = { picks: 0, wins: 0 };
    byCourse[c].picks++;
    if (e.winHit) byCourse[c].wins++;
  }

  return {
    windowDays,
    totalPicks: modelPicks.length,
    wins,
    top3,
    winRate: modelPicks.length ? wins / modelPicks.length : 0,
    top3Rate: modelPicks.length ? top3 / modelPicks.length : 0,
    roiFlatStake: staked ? roi / staked : 0,
    confidentPicks: confident.length,
    confidentWins,
    confidentWinRate: confident.length ? confidentWins / confident.length : 0,
    valuePicks: confident.length,
    valueWins: confidentWins,
    valueWinRate: confident.length ? confidentWins / confident.length : 0,
    napPicks: naps.length,
    napWins,
    napWinRate: naps.length ? napWins / naps.length : 0,
    ewGemPicks: ewGems.length,
    ewGemPlaces: ewPlaces,
    ewGemPlaceRate: ewGems.length ? ewPlaces / ewGems.length : 0,
    byCourse,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadPerformanceStats(
  windowDays = 90
): Promise<RacingPerformanceStats> {
  const ledger = await loadLedger();
  return computePerformanceStats(ledger.entries, windowDays);
}

export async function getLedgerEntries(): Promise<PerformanceLedgerEntry[]> {
  const ledger = await loadLedger();
  return ledger.entries;
}
