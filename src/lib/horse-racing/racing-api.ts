/**
 * The Racing API client — UK & Ireland live racecards.
 * https://api.theracingapi.com/documentation/
 */

import { distanceYards, enrichRunner, parseFormPositions } from "./form-analysis";
import type { HorseFormRun, HorseRace, HorseRunner } from "./types";

const BASE = "https://api.theracingapi.com/v1";

export interface RacingApiCredentials {
  username: string;
  password: string;
}

export interface RacingFetchResult {
  races: HorseRace[];
  debug: string;
}

export function getRacingApiCredentials(): RacingApiCredentials | null {
  const user = process.env.RACING_API_USERNAME?.trim();
  const pass = process.env.RACING_API_PASSWORD?.trim();
  if (user && pass) return { username: user, password: pass };

  const combined = process.env.RACING_API_KEY;
  if (combined?.includes(":")) {
    const [username, password] = combined.split(":", 2);
    if (username && password) return { username, password };
  }
  return null;
}

export function isRacingApiConfigured(): boolean {
  return getRacingApiCredentials() != null;
}

function authHeader(creds: RacingApiCredentials): string {
  return `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`;
}

async function racingFetch<T>(
  path: string,
  creds: RacingApiCredentials
): Promise<{ data: T | null; status: number; note: string }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        Authorization: authHeader(creds),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { data: null, status: res.status, note: "auth failed" };
    }
    if (!res.ok) {
      return { data: null, status: res.status, note: `HTTP ${res.status}` };
    }
    return { data: (await res.json()) as T, status: res.status, note: "ok" };
  } catch (e) {
    return { data: null, status: 0, note: `fetch error: ${e}` };
  }
}

const MEETING_FILTER: Record<string, (course: string) => boolean> = {
  "todays-races": () => true,
  cheltenham: (c) => /cheltenham/i.test(c),
  punchestown: (c) => /punchestown/i.test(c),
  aintree: (c) => /aintree/i.test(c),
};

interface ApiRunner {
  horse_id?: string;
  horse?: string;
  number?: string | number;
  age?: string | number;
  weight?: string;
  lbs?: string;
  jockey?: string;
  trainer?: string;
  form?: string;
  sp_dec?: string | number;
  odds?: Array<{ decimal?: string | number }>;
  comment?: string;
  spotlight?: string;
}

interface ApiRace {
  race_id?: string;
  course?: string;
  date?: string;
  off?: string;
  off_time?: string;
  off_dt?: string;
  race_name?: string;
  dist?: string;
  dist_y?: string | number;
  dist_f?: string | number;
  distance_f?: string | number;
  going?: string;
  class?: string;
  race_class?: string;
  runners?: ApiRunner[];
}

interface RacecardsResponse {
  racecards?: ApiRace[];
  results?: ApiRace[];
  courses?: Array<{ course?: string; races?: ApiRace[] }>;
}

interface HorseResultRow {
  date?: string;
  course?: string;
  dist?: string;
  dist_y?: string | number;
  distance_f?: string | number;
  going?: string;
  position?: string | number;
  runners?: string | number;
  jockey?: string;
  trainer?: string;
  weight?: string;
  lbs?: string;
  sp?: string;
  comment?: string;
}

interface HorseResultsResponse {
  results?: HorseResultRow[];
}

function flattenRacecards(data: RacecardsResponse): ApiRace[] {
  if (data.racecards?.length) return data.racecards;
  if (data.results?.length) return data.results;
  const out: ApiRace[] = [];
  for (const c of data.courses ?? []) {
    for (const r of c.races ?? []) {
      out.push({ ...r, course: r.course ?? c.course });
    }
  }
  return out;
}

function parseOdds(runner: ApiRunner): number | null {
  if (runner.sp_dec != null) {
    const n = Number(runner.sp_dec);
    if (!Number.isNaN(n) && n > 1) return n;
  }
  const dec = runner.odds?.[0]?.decimal;
  if (dec != null) {
    const n = Number(dec);
    if (!Number.isNaN(n) && n > 1) return n;
  }
  return null;
}

function parsePosition(raw: string | number | undefined): number {
  if (raw == null) return 99;
  const n = Number(String(raw).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 99;
}

function mapFormRun(row: HorseResultRow): HorseFormRun {
  const dist = String(row.dist ?? row.distance_f ?? "");
  const yards =
    row.dist_y != null
      ? Number(row.dist_y)
      : distanceYards(dist || "0f");
  return {
    date: String(row.date ?? ""),
    course: String(row.course ?? ""),
    distance: dist,
    distanceYards: yards,
    going: String(row.going ?? ""),
    position: parsePosition(row.position),
    runners: Number(row.runners ?? 0) || 12,
    jockey: String(row.jockey ?? ""),
    trainer: String(row.trainer ?? ""),
    weight: String(row.weight ?? row.lbs ?? ""),
    odds: String(row.sp ?? ""),
    comment: String(row.comment ?? ""),
  };
}

/** Minimal form runs from the form string when full history unavailable. */
function formRunsFromString(
  form: string,
  course: string,
  distance: string,
  yards: number
): HorseFormRun[] {
  const positions = parseFormPositions(form);
  if (!positions.length) return [];
  return positions.slice(0, 6).map((pos, i) => ({
    date: `recent-${i}`,
    course,
    distance,
    distanceYards: yards,
    going: "",
    position: pos,
    runners: 12,
    jockey: "",
    trainer: "",
    weight: "",
    odds: "",
    comment: `Form figure ${form[i] ?? ""}`,
  }));
}

async function fetchHorseFormRuns(
  horseId: string,
  creds: RacingApiCredentials
): Promise<HorseFormRun[]> {
  const { data } = await racingFetch<HorseResultsResponse>(
    `/horses/${encodeURIComponent(horseId)}/results?limit=8`,
    creds
  );
  return (data?.results ?? []).map(mapFormRun);
}

function mapRace(api: ApiRace): HorseRace {
  const distStr = String(
    api.dist ?? api.distance_f ?? api.dist_f ?? ""
  );
  const yards =
    api.dist_y != null ? Number(api.dist_y) : distanceYards(distStr);
  const time = api.off_time ?? api.off ?? (api.off_dt ? api.off_dt.slice(11, 16) : "TBC");
  const id =
    api.race_id ??
    `${api.course}-${api.date ?? "today"}-${time}`.replace(/\s+/g, "-");

  return {
    id: String(id),
    date: String(api.date ?? ""),
    time: String(time),
    name: String(api.race_name ?? "Race"),
    course: String(api.course ?? ""),
    distance: distStr || `${yards}y`,
    distanceYards: yards,
    going: String(api.going ?? ""),
    raceClass: String(api.race_class ?? api.class ?? ""),
    runners: [],
  };
}

async function mapRunner(
  api: ApiRunner,
  race: HorseRace,
  creds: RacingApiCredentials,
  fetchHistory: boolean
): Promise<HorseRunner> {
  let formRuns: HorseFormRun[] = [];
  if (fetchHistory && api.horse_id) {
    formRuns = await fetchHorseFormRuns(api.horse_id, creds);
    await new Promise((r) => setTimeout(r, 520));
  }
  if (!formRuns.length && api.form) {
    formRuns = formRunsFromString(
      api.form,
      race.course,
      race.distance,
      race.distanceYards
    );
  }

  const base: Omit<
    HorseRunner,
    | "distanceFitScore"
    | "courseFitScore"
    | "recentFormScore"
    | "overallScore"
    | "notes"
  > = {
    id: String(api.horse_id ?? `${race.id}-${api.number ?? api.horse}`),
    name: String(api.horse ?? "Unknown"),
    age: Number(api.age ?? 0) || 5,
    weight: String(api.lbs ?? api.weight ?? ""),
    jockey: String(api.jockey ?? ""),
    trainer: String(api.trainer ?? ""),
    form: String(api.form ?? ""),
    odds: parseOdds(api),
    formRuns,
  };

  return enrichRunner(base, race.course, race.distanceYards);
}

async function buildRacesFromApi(
  raw: ApiRace[],
  creds: RacingApiCredentials
): Promise<HorseRace[]> {
  const fetchHistory = process.env.RACING_FETCH_HISTORY === "true";
  const races: HorseRace[] = [];

  for (const apiRace of raw.slice(0, 20)) {
    const race = mapRace(apiRace);
    const runners = apiRace.runners ?? [];
    const mapped: HorseRunner[] = [];

    for (const [i, r] of runners.entries()) {
      mapped.push(
        await mapRunner(r, race, creds, fetchHistory && i < 3)
      );
    }

    race.runners = mapped;
    if (mapped.length) races.push(race);
  }

  return races;
}

function endpointsForDate(isoDate: string, dayOffset: number): string[] {
  if (dayOffset === 0) {
    return [
      "/racecards/free?day=today",
      "/racecards/basic?day=today",
    ];
  }
  if (dayOffset === 1) {
    return [
      "/racecards/free?day=tomorrow",
      "/racecards/basic?day=tomorrow",
    ];
  }
  const q = encodeURIComponent(isoDate);
  return [
    `/racecards/pro?date=${q}`,
    `/racecards/free?date=${q}`,
    `/racecards/basic?date=${q}`,
    `/racecards/summaries?date=${q}`,
  ];
}

/** Fetch all UK/IRE racecards for a single calendar date. */
export async function fetchRacecardsForDate(
  isoDate: string,
  dayOffset: number
): Promise<RacingFetchResult> {
  const creds = getRacingApiCredentials();
  if (!creds) {
    return { races: [], debug: "no credentials" };
  }

  const notes: string[] = [];

  for (const path of endpointsForDate(isoDate, dayOffset)) {
    const { data, status, note } = await racingFetch<RacecardsResponse>(path, creds);
    notes.push(`${path} → ${note}${status ? ` (${status})` : ""}`);
    if (!data) continue;

    const raw = flattenRacecards(data);
    if (!raw.length) {
      notes.push(`${path}: empty`);
      continue;
    }

    const races = await buildRacesFromApi(raw, creds);
    if (races.length) {
      console.log(`  racing api: ${races.length} races for ${isoDate} via ${path}`);
      return { races, debug: notes.join("; ") };
    }
    notes.push(`${path}: no runners`);
  }

  return { races: [], debug: notes.join("; ") };
}

/** @deprecated Use fetchRacecardsForDate — kept for legacy hub export */
export async function fetchLiveRacecards(
  meeting: string
): Promise<RacingFetchResult> {
  const filter = MEETING_FILTER[meeting] ?? (() => true);
  const result = await fetchRacecardsForDate(
    new Date().toISOString().slice(0, 10),
    0
  );
  return {
    races: result.races.filter((r) => filter(r.course)),
    debug: result.debug,
  };
}
