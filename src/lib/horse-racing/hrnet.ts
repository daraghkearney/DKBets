/**
 * HorseRacing.net scraper — free, rich per-runner stats that the Racing
 * API free tier doesn't provide: live decimal odds, RPR/Topspeed ratings,
 * trainer & jockey strike rates, days since last run, course/distance
 * winner flags, expert spotlight comments, the site verdict pick and —
 * crucially — named newspaper-tipster selections per runner.
 *
 * Also scrapes full results (position, SP, jockey, trainer) which keeps
 * the learning loop and the strike-rate archive working on any API plan.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { toIsoDate, ukToday } from "./dates";
import { distanceYards, enrichRunner, parseFormPositions } from "./form-analysis";

const HRN_BASE = "https://www.horseracing.net";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const CACHE_DIR = path.join(process.cwd(), ".cache", "racing-hrnet");
const CARDS_CACHE_VERSION = "v3";
const CARDS_TTL_MS = 90 * 60 * 1000;
const RESULTS_TTL_MS = 30 * 60 * 1000;
const FETCH_CONCURRENCY = 8;
const FETCH_RETRIES = 3;

export interface HrnRunner {
  name: string;
  number: number | null;
  draw: number | null;
  form: string;
  lastRanDays: number | null;
  jockey: string;
  /** Jockey 14-day strike rate % shown on the card */
  jockeyPct: number | null;
  trainer: string;
  trainerPct: number | null;
  age: number | null;
  weight: string;
  odds: number | null;
  officialRating: number | null;
  rpr: number | null;
  topspeed: number | null;
  tipCount: number;
  tippedBy: string[];
  courseWinner: boolean;
  distanceWinner: boolean;
  wonLastTimeOut: boolean;
  spotlight: string;
  nonRunner: boolean;
}

export interface HrnRace {
  courseSlug: string;
  course: string;
  /** 24h HH:MM */
  time: string;
  title: string;
  distance: string;
  distanceYards: number;
  raceClass: string;
  going: string;
  verdict: string;
  /** ALL-CAPS selection(s) named in the verdict */
  verdictPicks: string[];
  runners: HrnRunner[];
}

export interface HrnResultRunner {
  name: string;
  position: number;
  sp: number | null;
  jockey: string;
  trainer: string;
}

export interface HrnResultRace {
  courseSlug: string;
  course: string;
  time: string;
  name: string;
  going: string;
  distance: string;
  runners: HrnResultRunner[];
}

// ------------------------------------------------------------------ helpers

async function hrnFetch(pathname: string): Promise<string | null> {
  try {
    const res = await fetch(`${HRN_BASE}${pathname}`, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
        Referer: `${HRN_BASE}/racecards`,
      },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.length > 1000 ? html : null;
  } catch {
    return null;
  }
}

async function hrnFetchRetry(pathname: string): Promise<string | null> {
  for (let attempt = 0; attempt < FETCH_RETRIES; attempt++) {
    const html = await hrnFetch(pathname);
    if (html) return html;
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** ISO 2026-07-10 → HRN URL date 10-07-26 */
export function hrnDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y.slice(2)}`;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attrNum(row: string, attr: string): number | null {
  const m = row.match(new RegExp(`${attr}="([\\d.]+)"`, "i"));
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ------------------------------------------------------------ cards parsing

function parseRunnerRow(row: string): HrnRunner | null {
  const nameMatch = row.match(/fri-name">\s*([^<]+?)\s*(?:<span|<\/div)/);
  if (!nameMatch) return null;

  const lastRan = row.match(/fir-last-ran">(\d+)</);
  const form = row.match(/fs-form">([^<]*)</);
  const num = row.match(/fs-num">(\d+)(?:<span>\((\d+)\)<\/span>)?/);
  const jockey = row.match(
    /\/jockeys\/[^'"]*['"]>([^<]+)<\/a>(?:\s*<span class=['"]fi-tl['"]>(\d+)%)?/
  );
  const trainer = row.match(
    /\/trainers\/[^'"]*['"]>([^<]+)<\/a>\s*(?:<span class=['"]fi-tl['"]>(\d+)%)?/
  );
  const age = row.match(/Age:\s*<span>(\d+)<\/span>/);
  const weight = row.match(/Weight:\s*<span>([^<]+)<\/span>/);
  const ratings = row.match(
    /OR:\s*([\d-]+)?,?\s*<span>RPR:\s*(\d+)<\/span>,?\s*Topspeed:\s*(\d+)/
  );

  // Spotlight comment: text of fri-race-desc up to pointers/ratings block
  let spotlight = "";
  const desc = row.match(/fri-race-desc">([\s\S]*?)<\/div>\s*<\/div>/);
  if (desc) {
    spotlight = stripTags(
      desc[1]
        .replace(/<span class="frd-pointers">[\s\S]*$/, "")
        .replace(/<div class="frd-ratings">[\s\S]*$/, "")
    );
  }

  const tippedBy = [...row.matchAll(/ti-tipper">([^<]+)</g)].map((m) =>
    m[1].trim()
  );

  const or = ratings?.[1] ? Number(ratings[1]) : NaN;

  return {
    name: nameMatch[1].trim(),
    number: num ? Number(num[1]) : null,
    draw: num?.[2] ? Number(num[2]) : null,
    form: form?.[1]?.trim() ?? "",
    lastRanDays: lastRan ? Number(lastRan[1]) : null,
    jockey: jockey?.[1]?.trim() ?? "",
    jockeyPct: jockey?.[2] ? Number(jockey[2]) : null,
    trainer: trainer?.[1]?.trim() ?? "",
    trainerPct: trainer?.[2] ? Number(trainer[2]) : null,
    age: age ? Number(age[1]) : null,
    weight: weight?.[1]?.trim() ?? "",
    odds: attrNum(row, "data-oddsdecimal"),
    officialRating: Number.isFinite(or) && or > 0 ? or : null,
    rpr: attrNum(row, "data-rating"),
    topspeed: attrNum(row, "data-topspeed"),
    tipCount: attrNum(row, "data-tip") ?? 0,
    tippedBy,
    courseWinner: /data-coursewinner="1"/.test(row),
    distanceWinner: /data-distancewinner="1"/.test(row),
    wonLastTimeOut: /data-wonlasttimeout="1"/.test(row),
    spotlight,
    nonRunner: /non-runner|>NR</i.test(row),
  };
}

function verdictPicksFrom(verdict: string): string[] {
  // Site convention: the main selection appears in ALL CAPS
  const picks = new Set<string>();
  for (const m of verdict.matchAll(
    /\b([A-Z][A-Z']{2,}(?:\s+[A-Z][A-Z']{2,}){0,3})\b/g
  )) {
    const name = m[1].trim();
    // Skip shouty non-name tokens
    if (name.length >= 4 && !/^(THE|AND|NAP|ITV|BUT|WITH)$/.test(name)) {
      picks.add(name);
    }
  }
  return [...picks];
}

function parseRacePage(
  html: string,
  courseSlug: string,
  time: string
): HrnRace | null {
  const rows = html.split(/<div data-tip="/).slice(1);
  const runners: HrnRunner[] = [];
  for (const chunk of rows) {
    const runner = parseRunnerRow(`<div data-tip="${chunk}`);
    if (runner) runners.push(runner);
  }
  if (!runners.length) return null;

  const title = html.match(/<h4 class="chase-title">\s*([^<]+?)\s*<\/h4>/);
  const verdictMatch = html.match(
    /our-verdict-wrapper[\s\S]*?<p>([\s\S]*?)<\/p>/
  );
  const verdict = verdictMatch ? stripTags(verdictMatch[1]) : "";

  let distance = "";
  let going = "";
  const desc = html.match(/"description":\s*"([^"]+)"/);
  if (desc) {
    const parts = desc[1].split("|").map((s) => s.trim());
    if (parts[0]) distance = parts[0];
    if (parts[1]) going = parts[1].replace(/\(.*$/, "").trim();
  }
  if (!distance) {
    const distBox = html.match(/Distance\s+([^<]+?)\s*<\/span>/i);
    if (distBox) distance = distBox[1].trim();
  }

  const classMatch = html.match(/class="localization"[^>]*>\s*([^<]+)</);
  const raceClassRaw = classMatch?.[1]?.trim() ?? "";
  const raceClass = /class\s*\d/i.test(raceClassRaw)
    ? raceClassRaw.match(/class\s*\d/i)?.[0] ?? ""
    : "";

  return {
    courseSlug,
    course: titleCaseSlug(courseSlug),
    time,
    title: title?.[1] ?? "",
    distance,
    distanceYards: distanceYards(distance || "0f"),
    raceClass: /class/i.test(raceClass) ? raceClass : "",
    going,
    verdict,
    verdictPicks: verdictPicksFrom(verdict),
    runners,
  };
}

// ------------------------------------------------------------------- cache

interface CardsCacheEntry {
  savedAt: string;
  races: HrnRace[];
}

async function loadCache<T>(file: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await readFile(path.join(CACHE_DIR, file), "utf8");
    const data = JSON.parse(raw) as { savedAt: string } & T;
    if (Date.now() - new Date(data.savedAt).getTime() > ttlMs) return null;
    return data;
  } catch {
    return null;
  }
}

async function saveCache(file: string, data: object): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    path.join(CACHE_DIR, file),
    JSON.stringify({ savedAt: new Date().toISOString(), ...data }),
    "utf8"
  );
}

// ------------------------------------------------------------------ public

/**
 * Scrape all HRN racecards for a date. One index fetch + one fetch per
 * race, throttled; cached so hourly CI runs refresh at most once/45min.
 */
export async function fetchHrnRacecards(
  isoDate: string,
  courseFilter?: string[]
): Promise<HrnRace[]> {
  const cacheFile = `cards-${CARDS_CACHE_VERSION}-${isoDate}.json`;
  const cached = await loadCache<CardsCacheEntry>(cacheFile, CARDS_TTL_MS);
  if (cached) {
    console.log(
      `  hrn cards: cache hit ${isoDate} (${cached.races.length} races)`
    );
    return cached.races;
  }

  const d = hrnDate(isoDate);
  let index =
    (await hrnFetchRetry(`/racecards/${d}`)) ??
    (await hrnFetchRetry("/racecards"));
  if (!index) {
    console.warn(`  hrn cards: index fetch failed for ${isoDate}`);
    return [];
  }

  const allowed = courseFilter?.length
    ? new Set(courseFilter.map((c) => c.toLowerCase()))
    : null;

  const links = [
    ...new Set(
      [...index.matchAll(
        new RegExp(`href="/([a-z-]+)/${d}/(\\d{1,2}:\\d{2})"`, "g")
      )]
        .filter((m) => !allowed || allowed.has(m[1].toLowerCase()))
        .map((m) => `${m[1]}|${m[2]}`)
    ),
  ];
  if (!links.length) {
    console.warn(`  hrn cards: no race links for ${isoDate}`);
    return [];
  }

  const parsed = await mapPool(links, FETCH_CONCURRENCY, async (link) => {
    const [slug, time] = link.split("|");
    const html = await hrnFetchRetry(`/${slug}/${d}/${time}`);
    return html ? parseRacePage(html, slug, time) : null;
  });

  const races = parsed.filter((r): r is HrnRace => r != null);

  console.log(
    `  hrn cards: scraped ${races.length}/${links.length} races for ${isoDate}`
  );
  if (races.length >= Math.min(links.length, 8)) {
    await saveCache(cacheFile, { races });
  }
  return races;
}

// --------------------------------------------------------- results parsing

function parseResultsPage(
  html: string,
  courseSlug: string
): HrnResultRace[] {
  const races: HrnResultRace[] = [];
  const sections = html.split(/<section data-time="/).slice(1);

  for (const section of sections) {
    const time = section.match(/^(\d{1,2}:\d{2})"/)?.[1] ?? "";
    const name =
      section.match(/<h4 class="chase-title">\s*([^<]+?)\s*<\/h4>/)?.[1] ?? "";
    const going =
      section.match(/Going\s+([^<]+?)\s*<\/span>/)?.[1]?.trim() ?? "";
    const distance =
      section.match(/Distance\s+([^<]+?)\s*<\/span>/)?.[1]?.trim() ?? "";

    const runners: HrnResultRunner[] = [];
    for (const rowChunk of section.split(
      /<li class="results-table-row"/
    ).slice(1)) {
      const row = rowChunk.slice(0, 4000);
      const posMatch =
        row.match(/position-highlight'>\s*(\d+)(?:st|nd|rd|th)/i) ??
        row.match(/class="number position">\s*(\d+)(?:st|nd|rd|th)/i);
      const nameMatch = row.match(/runner-title">\s*([^<]+?)\s*<\/a>/);
      if (!nameMatch) continue;
      const sp = attrNum(row, "data-oddsdecimal");
      runners.push({
        name: nameMatch[1].trim(),
        position: posMatch ? Number(posMatch[1]) : 99,
        sp: sp != null && sp > 1 ? sp : null,
        jockey: row.match(/\/jockeys\/[^"']*["']>([^<]+)</)?.[1]?.trim() ?? "",
        trainer:
          row.match(/\/trainers\/[^"']*["']>([^<]+)</)?.[1]?.trim() ?? "",
      });
    }

    if (runners.some((r) => r.position === 1)) {
      races.push({
        courseSlug,
        course: titleCaseSlug(courseSlug),
        time,
        name,
        going,
        distance,
        runners,
      });
    }
  }

  return races;
}

interface ResultsCacheEntry {
  savedAt: string;
  races: HrnResultRace[];
}

/**
 * Scrape a full day of UK+IRE results: index page for the course list,
 * then each course's full-result page (positions, SP, jockey, trainer).
 * Completed past days cache indefinitely.
 */
export async function fetchHrnResultsForDate(
  isoDate: string
): Promise<HrnResultRace[]> {
  const cacheFile = `results-${isoDate}.json`;
  const today = toIsoDate(ukToday());
  const ttl = isoDate < today ? Number.POSITIVE_INFINITY : RESULTS_TTL_MS;
  const cached = await loadCache<ResultsCacheEntry>(cacheFile, ttl);
  if (cached) return cached.races;

  const d = hrnDate(isoDate);
  const index = await hrnFetch(`/results/${d}`);
  if (!index) return [];

  const slugs = [
    ...new Set(
      [...index.matchAll(
        new RegExp(`href="/results/([a-z-]+)/${d}#`, "g")
      )].map((m) => m[1])
    ),
  ];

  const parsed = await mapPool(slugs, FETCH_CONCURRENCY, async (slug) => {
    const html = await hrnFetchRetry(`/results/${slug}/${d}`);
    return html ? parseResultsPage(html, slug) : [];
  });
  const races = parsed.flat();

  console.log(
    `  hrn results: ${races.length} races from ${slugs.length} courses (${isoDate})`
  );
  if (races.length) await saveCache(cacheFile, { races });
  return races;
}
