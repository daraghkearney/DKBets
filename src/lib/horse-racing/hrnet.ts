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
const CARDS_CACHE_VERSION = "v4";
const CARDS_TTL_MS = 90 * 60 * 1000;
const RESULTS_TTL_MS = 30 * 60 * 1000;
const FETCH_CONCURRENCY = 8;
const FETCH_RETRIES = 3;
const TAVILY_BATCH = 20;
const TAVILY_EXTRACT_DEPTH = "advanced" as const;

export type HrnFetchMode = "direct" | "tavily" | "mixed";

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

function isHtmlContent(content: string): boolean {
  return /<div\s+data-tip=|<h4 class="chase-title">/i.test(content);
}

function fracToDecimal(frac: string): number | null {
  const m = frac.trim().match(/^(\d+)\/(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]) / Number(m[2]) + 1;
  return Number.isFinite(n) && n > 1 ? Math.round(n * 100) / 100 : null;
}

function pointersFromSpotlight(spotlight: string): {
  courseWinner: boolean;
  distanceWinner: boolean;
  wonLastTimeOut: boolean;
} {
  const tail = spotlight.split(".").pop() ?? "";
  const codes = tail.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return {
    courseWinner: codes.includes("C") || codes.includes("CD"),
    distanceWinner: codes.includes("D") || codes.includes("CD"),
    wonLastTimeOut: codes.includes("W") || /\bwon last time out\b/i.test(spotlight),
  };
}

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

interface TavilyExtractResponse {
  results?: { url: string; raw_content?: string }[];
  failed_results?: { url: string; error?: string }[];
}

async function tavilyExtractUrls(urls: string[]): Promise<Map<string, string>> {
  const key = process.env.TAVILY_API_KEY;
  const out = new Map<string, string>();
  if (!key || !urls.length) return out;

  for (let i = 0; i < urls.length; i += TAVILY_BATCH) {
    const batch = urls.slice(i, i + TAVILY_BATCH);
    try {
      const res = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          urls: batch,
          extract_depth: TAVILY_EXTRACT_DEPTH,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        console.warn(`  hrn tavily: extract ${res.status} (batch ${i / TAVILY_BATCH + 1})`);
        continue;
      }
      const data = (await res.json()) as TavilyExtractResponse;
      for (const row of data.results ?? []) {
        if (row.raw_content && row.raw_content.length > 500) {
          out.set(row.url, row.raw_content);
        }
      }
      if (data.failed_results?.length) {
        console.warn(
          `  hrn tavily: ${data.failed_results.length} failed in batch ${i / TAVILY_BATCH + 1}`
        );
      }
    } catch (e) {
      console.warn("  hrn tavily: extract batch failed", e);
    }
    if (i + TAVILY_BATCH < urls.length) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return out;
}

async function tavilyExtractOne(url: string): Promise<string | null> {
  const map = await tavilyExtractUrls([url]);
  return map.get(url) ?? null;
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

function parseIndexLinks(content: string, d: string): string[] {
  const htmlLinks = [
    ...content.matchAll(
      new RegExp(`href="/([a-z-]+)/${d}/(\\d{1,2}:\\d{2})"`, "g")
    ),
  ];
  if (htmlLinks.length) {
    return [
      ...new Set(htmlLinks.map((m) => `${m[1]}|${m[2]}`)),
    ];
  }

  const links: string[] = [];
  const urlRe = new RegExp(
    `https://www\\.horseracing\\.net/([a-z-]+)/${d.replace(/-/g, "\\-")}`,
    "g"
  );
  const sections: { slug: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(content)) !== null) {
    sections.push({ slug: m[1], start: m.index + m[0].length });
  }
  for (let i = 0; i < sections.length; i++) {
    const end =
      i + 1 < sections.length ? sections[i + 1].start - 40 : content.length;
    const block = content.slice(sections[i].start, end);
    for (const t of block.matchAll(/^(\d{1,2}:\d{2})$/gm)) {
      links.push(`${sections[i].slug}|${t[1]}`);
    }
  }
  return [...new Set(links)];
}

function parseRunnerMarkdown(block: string): HrnRunner | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const numDraw = lines[0].match(/^(\d+)\((\d+)\)$/);
  if (!numDraw) return null;

  let idx = 1;
  const form = lines[idx]?.match(/^[\d\-/pfpux]+$/i) ? lines[idx++] : "";

  let tipCount = 0;
  const tipLine = lines[idx]?.match(/^(\d+)\s+Tips?$/i);
  if (tipLine) {
    tipCount = Number(tipLine[1]);
    idx++;
  }

  const nameLine = lines[idx++];
  if (!nameLine) return null;
  const nameMatch = nameLine.match(/^(.+?)\s+(\d+)$/);
  const name = (nameMatch?.[1] ?? nameLine).trim();
  const lastRanDays = nameMatch?.[2] ? Number(nameMatch[2]) : null;
  if (/non.?runner|^NR$/i.test(name)) {
    return {
      name,
      number: Number(numDraw[1]),
      draw: Number(numDraw[2]),
      form,
      lastRanDays,
      jockey: "",
      jockeyPct: null,
      trainer: "",
      trainerPct: null,
      age: null,
      weight: "",
      odds: null,
      officialRating: null,
      rpr: null,
      topspeed: null,
      tipCount: 0,
      tippedBy: [],
      courseWinner: false,
      distanceWinner: false,
      wonLastTimeOut: false,
      spotlight: "",
      nonRunner: true,
    };
  }

  let jockey = "";
  let jockeyPct: number | null = null;
  let trainer = "";
  let trainerPct: number | null = null;
  let age: number | null = null;
  let weight = "";
  const tippedBy: string[] = [];
  const spotlightParts: string[] = [];
  let officialRating: number | null = null;
  let rpr: number | null = null;
  let topspeed: number | null = null;
  let odds: number | null = null;
  let afterOr = false;

  for (; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line === "Jockey" && lines[idx + 1]) {
      const jm = lines[++idx].match(/^(.+?)\s+(\d+)%$/);
      if (jm) {
        jockey = jm[1].trim();
        jockeyPct = Number(jm[2]);
      }
      continue;
    }
    if (line === "Trainer" && lines[idx + 1]) {
      const tm = lines[++idx].match(/^(.+?)\s+(\d+)%$/);
      if (tm) {
        trainer = tm[1].trim();
        trainerPct = Number(tm[2]);
      }
      continue;
    }
    const ageM = line.match(/^Age:\s*(\d+)$/i);
    if (ageM) {
      age = Number(ageM[1]);
      continue;
    }
    const wtM = line.match(/^Weight:\s*(.+)$/i);
    if (wtM) {
      weight = wtM[1].trim();
      continue;
    }
    const ratM = line.match(/^OR:\s*([\d-]+)?,?\s*RPR:\s*(\d+),?\s*Topspeed:\s*(\d+)/i);
    if (ratM) {
      const or = ratM[1] ? Number(ratM[1]) : NaN;
      officialRating = Number.isFinite(or) && or > 0 ? or : null;
      rpr = Number(ratM[2]);
      topspeed = Number(ratM[3]);
      afterOr = true;
      continue;
    }
    if (/^Tipped By:$/i.test(line)) continue;
    if (afterOr && !odds) {
      const dec = fracToDecimal(line);
      if (dec) odds = dec;
    }
    if (afterOr && tippedBy.length < tipCount && line.length > 1 && line.length < 60) {
      if (
        !/^\d+\/\d+/.test(line) &&
        !/^£/.test(line) &&
        !/^EW /.test(line) &&
        !/^Show /.test(line) &&
        !/^Use /.test(line) &&
        !/^Check /.test(line) &&
        !/^Odds /.test(line) &&
        !/^Win /.test(line) &&
        line !== "Tipped By:"
      ) {
        tippedBy.push(line);
      }
    }
    if (
      !afterOr &&
      line !== "Jockey" &&
      line !== "Trainer" &&
      !/^Age:/i.test(line) &&
      !/^Weight:/i.test(line) &&
      !/^\d+\s+Tips?$/i.test(line)
    ) {
      spotlightParts.push(line);
    }
  }

  const spotlight = spotlightParts.join(" ").trim();
  const ptr = pointersFromSpotlight(spotlight);

  return {
    name,
    number: Number(numDraw[1]),
    draw: Number(numDraw[2]),
    form,
    lastRanDays,
    jockey,
    jockeyPct,
    trainer,
    trainerPct,
    age,
    weight,
    odds,
    officialRating,
    rpr,
    topspeed,
    tipCount: tipCount || tippedBy.length,
    tippedBy,
    courseWinner: ptr.courseWinner,
    distanceWinner: ptr.distanceWinner,
    wonLastTimeOut: ptr.wonLastTimeOut,
    spotlight,
    nonRunner: false,
  };
}

function parseRacePageMarkdown(
  content: string,
  courseSlug: string,
  time: string
): HrnRace | null {
  const racecardIdx = content.search(/^##\s*Racecard$/im);
  const slice = racecardIdx >= 0 ? content.slice(racecardIdx) : content;

  const verdictMatch =
    slice.match(/## Racecard\s*\n+([^\n#][^\n]+)/i) ??
    slice.match(/Progressive[\s\S]{20,300}\./i);
  const verdict = verdictMatch ? verdictMatch[0].replace(/^## Racecard\s*/i, "").trim() : "";

  const titleMatch =
    content.match(/##\s+[^\n]+\d{1,2}:\d{2}\s*\n+####\s+([^\n]+)/) ??
    content.match(/####\s+(?!Time\b)([^\n]+)/);
  const title = titleMatch?.[1]?.trim() ?? "";

  let distance = "";
  let going = "";
  const meta = content.match(
    /Flat,Turf\s*,\s*([^,]+)\s*,\s*([^(]+?)(?:\s*\(|$)/i
  );
  if (meta) {
    distance = meta[1].trim();
    going = meta[2].trim();
  }
  if (!distance) {
    const distM = content.match(/\b(\d+m(?:\s*\d+f)?(?:\s*\d+y)?)\b/i);
    if (distM) distance = distM[1];
  }

  const classMatch = content.match(/\bCL(\d)\b/i);
  const raceClass = classMatch ? `Class ${classMatch[1]}` : "";

  const blocks = slice.split(/\n(?=\d+\(\d+\)\n)/).slice(1);
  const runners: HrnRunner[] = [];
  for (const block of blocks) {
    const runner = parseRunnerMarkdown(block);
    if (runner && !runner.nonRunner) runners.push(runner);
  }
  if (!runners.length) return null;

  return {
    courseSlug,
    course: titleCaseSlug(courseSlug),
    time,
    title,
    distance,
    distanceYards: distanceYards(distance || "0f"),
    raceClass,
    going,
    verdict,
    verdictPicks: verdictPicksFrom(verdict),
    runners,
  };
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
  content: string,
  courseSlug: string,
  time: string
): HrnRace | null {
  if (isHtmlContent(content)) {
    return parseRacePageHtml(content, courseSlug, time);
  }
  return parseRacePageMarkdown(content, courseSlug, time);
}

function parseRacePageHtml(
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
  let fetchMode: HrnFetchMode = "direct";
  let index =
    (await hrnFetchRetry(`/racecards/${d}`)) ??
    (await hrnFetchRetry("/racecards"));

  if (!index && process.env.TAVILY_API_KEY) {
    console.log(`  hrn cards: direct blocked — trying Tavily for index (${isoDate})`);
    index =
      (await tavilyExtractOne(`${HRN_BASE}/racecards/${d}`)) ??
      (await tavilyExtractOne(`${HRN_BASE}/racecards`));
    if (index) fetchMode = "tavily";
  }

  if (!index) {
    console.warn(`  hrn cards: index fetch failed for ${isoDate} (mode=${fetchMode})`);
    return [];
  }

  const allowed = courseFilter?.length
    ? new Set(courseFilter.map((c) => c.toLowerCase()))
    : null;

  const links = parseIndexLinks(index, d).filter(
    (link) => !allowed || allowed.has(link.split("|")[0].toLowerCase())
  );

  if (!links.length) {
    console.warn(`  hrn cards: no race links for ${isoDate}`);
    return [];
  }

  let races: HrnRace[] = [];

  if (fetchMode === "tavily") {
    const urls = links.map((link) => {
      const [slug, time] = link.split("|");
      return `${HRN_BASE}/${slug}/${d}/${time}`;
    });
    const contents = await tavilyExtractUrls(urls);
    console.log(
      `  hrn tavily: extracted ${contents.size}/${links.length} race pages`
    );
    races = links
      .map((link) => {
        const [slug, time] = link.split("|");
        const content = contents.get(`${HRN_BASE}/${slug}/${d}/${time}`);
        return content ? parseRacePage(content, slug, time) : null;
      })
      .filter((r): r is HrnRace => r != null);
  } else {
    const parsed = await mapPool(links, FETCH_CONCURRENCY, async (link) => {
      const [slug, time] = link.split("|");
      const html = await hrnFetchRetry(`/${slug}/${d}/${time}`);
      return html ? parseRacePage(html, slug, time) : null;
    });

    const missing: string[] = [];
    const ok: (HrnRace | null)[] = [...parsed];
    for (let i = 0; i < links.length; i++) {
      if (!ok[i]) missing.push(links[i]);
    }

    if (missing.length && process.env.TAVILY_API_KEY) {
      fetchMode = "mixed";
      const urls = missing.map(
        (link) => `${HRN_BASE}/${link.split("|")[0]}/${d}/${link.split("|")[1]}`
      );
      const contents = await tavilyExtractUrls(urls);
      for (let i = 0; i < missing.length; i++) {
        const link = missing[i];
        const [slug, time] = link.split("|");
        const content = contents.get(`${HRN_BASE}/${slug}/${d}/${time}`);
        if (!content) continue;
        const race = parseRacePage(content, slug, time);
        const idx = links.indexOf(link);
        if (race && idx >= 0) ok[idx] = race;
      }
    }

    races = ok.filter((r): r is HrnRace => r != null);
  }

  console.log(
    `  hrn cards: scraped ${races.length}/${links.length} races for ${isoDate} (${fetchMode})`
  );
  if (races.length >= Math.min(links.length, 8)) {
    await saveCache(cacheFile, { races, fetchMode });
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
