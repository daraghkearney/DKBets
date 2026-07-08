/**
 * The Racing API client — UK & Ireland live racecards.
 * https://api.theracingapi.com/documentation/
 *
 * Auth: HTTP Basic (username + password from dashboard).
 * Env: RACING_API_USERNAME + RACING_API_PASSWORD
 *      or RACING_API_KEY="username:password"
 */

import { distanceYards, enrichRunner } from "./form-analysis";
import type { HorseFormRun, HorseRace, HorseRunner } from "./types";

const BASE = "https://api.theracingapi.com/v1";

export interface RacingApiCredentials {
  username: string;
  password: string;
}

export function getRacingApiCredentials(): RacingApiCredentials | null {
  const user = process.env.RACING_API_USERNAME;
  const pass = process.env.RACING_API_PASSWORD;
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
): Promise<T | null> {
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
      console.warn("  racing api: auth failed — check RACING_API_USERNAME/PASSWORD");
      return null;
    }
    if (!res.ok) {
      console.warn(`  racing api: ${res.status} for ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn("  racing api: fetch failed", e);
    return null;
  }
}

/** Course name matchers per meeting slug */
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
  weight_lbs?: string | number;
  jockey?: string;
  trainer?: string;
  form?: string;
  sp_dec?: string | number;
  odds?: Array<{ decimal?: string | number }>;
  comment?: string;
}

interface ApiRace {
  race_id?: string;
  course?: string;
  off?: string;
  off_dt?: string;
  race_name?: string;
  dist?: string;
  dist_y?: string | number;
  dist_f?: string | number;
  going?: string;
  class?: string;
  runners?: ApiRunner[];
}

interface RacecardsResponse {
  racecards?: ApiRace[];
  /** Some endpoints nest under courses */
  courses?: Array<{ course?: string; races?: ApiRace[] }>;
}

interface HorseResultRow {
  date?: string;
  course?: string;
  dist?: string;
  dist_y?: string | number;
  going?: string;
  position?: string | number;
  runners?: string | number;
  jockey?: string;
  trainer?: string;
  weight?: string;
  sp?: string;
  comment?: string;
}

interface HorseResultsResponse {
  results?: HorseResultRow[];
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
  const dist = String(row.dist ?? "");
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
    weight: String(row.weight ?? ""),
    odds: String(row.sp ?? ""),
    comment: String(row.comment ?? ""),
  };
}

async function fetchHorseFormRuns(
  horseId: string,
  creds: RacingApiCredentials
): Promise<HorseFormRun[]> {
  const data = await racingFetch<HorseResultsResponse>(
    `/horses/${encodeURIComponent(horseId)}/results?limit=8`,
    creds
  );
  return (data?.results ?? []).map(mapFormRun);
}

function flattenRacecards(data: RacecardsResponse): ApiRace[] {
  if (data.racecards?.length) return data.racecards;
  const out: ApiRace[] = [];
  for (const c of data.courses ?? []) {
    for (const r of c.races ?? []) {
      out.push({ ...r, course: r.course ?? c.course });
    }
  }
  return out;
}

function mapRace(api: ApiRace): HorseRace {
  const distStr = String(api.dist ?? api.dist_f ?? "");
  const yards =
    api.dist_y != null ? Number(api.dist_y) : distanceYards(distStr);
  const time = api.off ?? (api.off_dt ? api.off_dt.slice(11, 16) : "TBC");

  return {
    id: String(api.race_id ?? `${api.course}-${time}`),
    time: String(time),
    name: String(api.race_name ?? "Race"),
    course: String(api.course ?? ""),
    distance: distStr || `${yards}y`,
    distanceYards: yards,
    going: String(api.going ?? ""),
    raceClass: String(api.class ?? ""),
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
    await new Promise((r) => setTimeout(r, 550));
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
    weight: String(api.weight ?? ""),
    jockey: String(api.jockey ?? ""),
    trainer: String(api.trainer ?? ""),
    form: String(api.form ?? ""),
    odds: parseOdds(api),
    formRuns,
  };

  return enrichRunner(base, race.course, race.distanceYards);
}

export async function fetchLiveRacecards(
  meeting: string
): Promise<HorseRace[] | null> {
  const creds = getRacingApiCredentials();
  if (!creds) return null;

  const filter = MEETING_FILTER[meeting] ?? (() => true);

  const data = await racingFetch<RacecardsResponse>(
    "/racecards/standard?day=today",
    creds
  );
  if (!data) {
    const basic = await racingFetch<RacecardsResponse>(
      "/racecards/basic?day=today",
      creds
    );
    if (!basic) return null;
    return buildFromApi(basic, filter, creds);
  }

  return buildFromApi(data, filter, creds);
}

async function buildFromApi(
  data: RacecardsResponse,
  filter: (course: string) => boolean,
  creds: RacingApiCredentials
): Promise<HorseRace[]> {
  const raw = flattenRacecards(data).filter((r) =>
    filter(String(r.course ?? ""))
  );

  const races: HorseRace[] = [];
  for (const apiRace of raw.slice(0, 12)) {
    const race = mapRace(apiRace);
    const runners = apiRace.runners ?? [];
    const mapped: HorseRunner[] = [];

    for (const [i, r] of runners.entries()) {
      const fetchHistory = i < 4;
      mapped.push(await mapRunner(r, race, creds, fetchHistory));
    }

    race.runners = mapped;
    races.push(race);
  }

  return races;
}
