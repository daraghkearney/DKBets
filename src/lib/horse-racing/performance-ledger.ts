import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { addDays, toIsoDate, ukToday } from "./dates";
import type { ResultRace } from "./racing-api";
import type { RacingNapPick, RacingPerformanceStats } from "./types";

const LEDGER_DIR = path.join(process.cwd(), ".cache", "racing-performance");
const LEDGER_FILE = path.join(LEDGER_DIR, "ledger.json");

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
}

interface LedgerFile {
  entries: PerformanceLedgerEntry[];
  updatedAt: string;
}

async function loadLedger(): Promise<LedgerFile> {
  try {
    const raw = await readFile(LEDGER_FILE, "utf8");
    return JSON.parse(raw) as LedgerFile;
  } catch {
    return { entries: [], updatedAt: new Date().toISOString() };
  }
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

/**
 * Record outcomes for races where we logged a #1 prediction.
 */
export async function recordDayOutcomes(
  date: string,
  results: ResultRace[],
  loggedRaces: PredictionRace[],
  napRaceIds?: Set<string>
): Promise<void> {
  const napIds = napRaceIds ?? (await loadNapRaceIds(date));
  const ledger = await loadLedger();
  const existing = new Set(
    ledger.entries.filter((e) => e.date === date).map((e) => e.raceId)
  );

  const byKey = new Map(
    loggedRaces.map((r) => [`${r.course}|${r.time}`, r])
  );
  const byId = new Map(loggedRaces.map((r) => [r.raceId, r]));

  for (const result of results) {
    const logged =
      byId.get(result.raceId) ??
      byKey.get(`${result.course}|${result.time}`);
    if (!logged) continue;
    if (existing.has(result.raceId)) continue;

    const pick = logged.runners.find((r) => r.rank === 1);
    if (!pick) continue;

    const winner = result.runners.find((r) => r.position === 1);
    if (!winner) continue;

    const winnerNorm = normaliseName(winner.name);
    const ranked = [...result.runners]
      .filter((r) => r.position > 0)
      .sort((a, b) => a.position - b.position);

    let winnerRank: number | null = null;
    for (const r of logged.runners) {
      if (normaliseName(r.name) === winnerNorm) {
        winnerRank = r.rank;
        break;
      }
    }

    ledger.entries.push({
      date,
      raceId: result.raceId,
      course: result.course,
      time: result.time,
      pick: pick.name,
      pickOdds: pick.odds,
      pickProb: pick.winProbability ?? null,
      pickEdge: pick.modelEdge ?? null,
      pickRank: 1,
      winner: winner.name,
      winnerSp: winner.sp ?? null,
      winnerRank,
      winHit: winnerRank === 1,
      top3Hit: winnerRank != null && winnerRank <= 3,
      isNap: napIds.has(result.raceId),
    });
  }

  // Keep last 120 days
  const cutoff = toIsoDate(addDays(ukToday(), -120));
  ledger.entries = ledger.entries.filter((e) => e.date >= cutoff);
  await saveLedger(ledger);
}

export function computePerformanceStats(
  entries: PerformanceLedgerEntry[],
  windowDays = 90
): RacingPerformanceStats {
  const cutoff = toIsoDate(addDays(ukToday(), -windowDays));
  const window = entries.filter((e) => e.date >= cutoff);

  const wins = window.filter((e) => e.winHit).length;
  const top3 = window.filter((e) => e.top3Hit).length;
  const naps = window.filter((e) => e.isNap);
  const napWins = naps.filter((e) => e.winHit).length;

  let roi = 0;
  let staked = 0;
  for (const e of window) {
    if (e.pickOdds == null || e.pickOdds <= 1) continue;
    staked += 1;
    if (e.winHit) roi += e.pickOdds - 1;
    else roi -= 1;
  }

  const byCourse: RacingPerformanceStats["byCourse"] = {};
  for (const e of window) {
    const c = e.course;
    if (!byCourse[c]) byCourse[c] = { picks: 0, wins: 0 };
    byCourse[c].picks++;
    if (e.winHit) byCourse[c].wins++;
  }

  return {
    windowDays,
    totalPicks: window.length,
    wins,
    top3,
    winRate: window.length ? wins / window.length : 0,
    top3Rate: window.length ? top3 / window.length : 0,
    roiFlatStake: staked ? roi / staked : 0,
    napPicks: naps.length,
    napWins,
    napWinRate: naps.length ? napWins / naps.length : 0,
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
