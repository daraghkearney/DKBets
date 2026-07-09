/**
 * Trainer & jockey strike-rate archive.
 *
 * Built from actual race results we fetch every day (and seeded from the
 * recent past on first run), so it works on any API plan and keeps
 * getting sharper: every completed race adds runs/wins for its trainer
 * and jockey. Scores use Bayesian smoothing so small samples stay
 * near-neutral instead of swinging wildly.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ResultRace } from "./racing-api";

const STATS_DIR = path.join(process.cwd(), ".cache", "racing-stats");
const STATS_FILE = path.join(STATS_DIR, "people.json");

interface PersonRecord {
  runs: number;
  wins: number;
  places: number;
}

export interface PeopleStats {
  trainers: Record<string, PersonRecord>;
  jockeys: Record<string, PersonRecord>;
  /** Result dates already ingested (prevents double counting) */
  dates: string[];
  updatedAt: string;
}

function emptyStats(): PeopleStats {
  return { trainers: {}, jockeys: {}, dates: [], updatedAt: "" };
}

export function personKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function loadPeopleStats(): Promise<PeopleStats> {
  try {
    const raw = await readFile(STATS_FILE, "utf8");
    const data = JSON.parse(raw) as PeopleStats;
    if (data.trainers && data.jockeys && Array.isArray(data.dates)) {
      return data;
    }
  } catch {
    // no stats yet
  }
  return emptyStats();
}

export async function savePeopleStats(stats: PeopleStats): Promise<void> {
  await mkdir(STATS_DIR, { recursive: true });
  stats.updatedAt = new Date().toISOString();
  // Keep the ingested-dates list bounded
  stats.dates = stats.dates.slice(-120);
  await writeFile(STATS_FILE, JSON.stringify(stats), "utf8");
}

function bump(
  table: Record<string, PersonRecord>,
  name: string,
  position: number
): void {
  const key = personKey(name);
  if (!key) return;
  const rec = table[key] ?? { runs: 0, wins: 0, places: 0 };
  rec.runs += 1;
  if (position === 1) rec.wins += 1;
  if (position <= 3) rec.places += 1;
  table[key] = rec;
}

/** Ingest one day of results into the archive (idempotent per date). */
export function ingestResults(
  stats: PeopleStats,
  date: string,
  races: ResultRace[]
): boolean {
  if (stats.dates.includes(date)) return false;
  for (const race of races) {
    for (const runner of race.runners) {
      if (runner.position >= 90) continue;
      if (runner.trainer) bump(stats.trainers, runner.trainer, runner.position);
      if (runner.jockey) bump(stats.jockeys, runner.jockey, runner.position);
    }
  }
  stats.dates.push(date);
  return true;
}

const PRIOR_WIN_RATE = 0.1;
const PRIOR_STRENGTH = 12;
const MIN_RUNS = 4;

/**
 * Smoothed strike-rate score on the 0-1 factor scale.
 * ~10% win rate (the base rate) maps to 0.5; a 25%+ trainer/jockey
 * with a real sample pushes toward 0.85.
 */
export function strikeRateScore(
  table: Record<string, PersonRecord>,
  name: string
): { score: number; note?: string; rate?: number } {
  const rec = table[personKey(name)];
  if (!rec || rec.runs < MIN_RUNS) return { score: 0.5 };

  const smoothed =
    (rec.wins + PRIOR_WIN_RATE * PRIOR_STRENGTH) /
    (rec.runs + PRIOR_STRENGTH);
  const score = Math.max(0.25, Math.min(0.9, 0.5 + (smoothed - PRIOR_WIN_RATE) * 2.4));
  const rate = rec.wins / rec.runs;
  const note =
    rate >= 0.2 && rec.runs >= 8
      ? `${Math.round(rate * 100)}% strike rate (${rec.wins}/${rec.runs})`
      : undefined;
  return { score, note, rate };
}
