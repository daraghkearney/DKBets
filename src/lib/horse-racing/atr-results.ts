/**
 * At The Races results fallback when the Racing API is rate-limited or empty.
 * https://www.attheraces.com/results/yesterday
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { addDays, courseSlug, to24hTime, toIsoDate, ukToday } from "./dates";
import { distanceYards } from "./form-analysis";
import type { ResultRace } from "./racing-api";

const ATR_BASE = "https://www.attheraces.com";
const CACHE_DIR = path.join(process.cwd(), ".cache", "atr-results");
const FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FOREIGN_MEETING =
  /\((France|USA|RSA|Argentina|CAN|AUS|UAE|HK|JPN|Uruguay)\)|Harness/i;

export interface AtrParsedRace {
  course: string;
  time: string;
  name: string;
  distance: string;
  going: string;
  runners: Array<{
    name: string;
    position: number;
    sp: number | null;
    jockey: string;
    trainer: string;
  }>;
}

function atrPathForDate(isoDate: string): string {
  const today = toIsoDate(ukToday());
  const yesterday = toIsoDate(addDays(ukToday(), -1));
  if (isoDate === yesterday) return "/results/yesterday";
  if (isoDate === today) return "/results/today";
  const [y, m, d] = isoDate.split("-");
  return `/results/${d}-${m}-${y}`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0*39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function fractionalToDecimal(odds: string): number | null {
  const m = odds.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!den) return null;
  return num / den + 1;
}

function cleanCourseName(raw: string): string {
  return raw
    .replace(/\s+Results\s*$/i, "")
    .replace(/\s*\(IRE\)\s*/i, "")
    .trim();
}

function extractDistance(raceTitle: string): string {
  const tail = raceTitle.match(
    /\)\s*(\d+(?:\.\d+)?\s*m(?:\s+\d+f(?:\s+\d+y)?)?|\d+f(?:\s+\d+y)?|\d+m\s+\d+f)\s*$/i
  );
  if (tail) return tail[1].trim();
  const simple = raceTitle.match(/(\d+f|\d+m(?:\s+\d+f)?)\s*$/i);
  return simple?.[1]?.trim() ?? "";
}

function cleanRaceName(raceTitle: string): string {
  return raceTitle
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+\d+f\s*$/i, "")
    .replace(/\s+\d+m(?:\s+\d+f)?\s*$/i, "")
    .trim();
}

/** Convert htmlToText output (or sparse markdown) into the Tavily-style layout. */
function normalizeAtrText(text: string): string {
  let t = text.replace(/\r/g, "").replace(/&#163;/g, "£");

  // "1\n 13:55 - Race Name" → "### 1 13:55 - Race Name"
  t = t.replace(
    /(?:^|\n)\s*(\d+)\s*\n\s*(\d{1,2}:\d{2})\s+-\s+([^\n]+)/g,
    (_, num, time, name) => `\n### ${num} ${time} - ${name.trim()}`
  );

  const lines = t.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^###\s+\d+\s+\d{1,2}:\d{2}\s+-/.test(trimmed)) {
      let header = trimmed;
      while (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (
          !next ||
          /^\d+(?:st|nd|rd|th)$/i.test(next) ||
          /^Winning /i.test(next) ||
          /^Runners:/i.test(next) ||
          /^###\s+\d+/.test(next) ||
          /Results$/i.test(next)
        ) {
          break;
        }
        if (/^\([\w\s+]+\)$/.test(next) || /^\d+(?:\.\d+)?\s*m|\d+f/i.test(next)) {
          header += ` ${next}`;
          i++;
          continue;
        }
        break;
      }
      out.push(header);
      continue;
    }

    const place = trimmed.match(/^(\d+)(?:st|nd|rd|th)$/i);
    if (place && lines[i + 1]?.trim().match(/^\(\d+\)$/)) {
      const cloth = lines[i + 1].trim();
      const horse = lines[i + 2]?.trim() ?? "";
      let odds = "";
      let j = i + 3;
      if (lines[j]?.trim().match(/^[\d/]/)) {
        odds = lines[j].trim();
        if (lines[j + 1]?.trim().match(/^[FJ2]+$/i)) {
          odds += ` ${lines[j + 1].trim()}`;
          j++;
        }
      }
      out.push(
        `${place[0]} ${cloth} ${horse}${odds ? ` ${odds}` : ""}`.trim()
      );
      i = j;
      continue;
    }

    if (/^Winning (jockey|trainer)\s*:/i.test(trimmed) && lines[i + 1]?.trim()) {
      out.push(`${trimmed} ${lines[i + 1].trim()}`);
      i++;
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

/** Parse ATR results page text (markdown or htmlToText output). */
export function parseAtrResultsText(text: string): AtrParsedRace[] {
  const races: AtrParsedRace[] = [];
  const normalized = normalizeAtrText(text);

  const courseBlocks = normalized.split(
    /(?=(?:^|\n)\s*#{0,3}\s*[A-Za-z][^\n]*?\s+Results\s*(?:\n|$))/im
  );

  for (const block of courseBlocks) {
    const courseMatch = block.match(
      /^\s*#{0,3}\s*([A-Za-z][A-Za-z' ().-]+?)\s+Results/im
    );
    if (!courseMatch) continue;
    const courseRaw = courseMatch[1].trim();
    if (FOREIGN_MEETING.test(courseRaw) || FOREIGN_MEETING.test(block.slice(0, 80))) {
      continue;
    }
    const course = cleanCourseName(courseRaw);

    const raceChunks = block.split(/(?=###\s*\d+\s+\d{1,2}:\d{2}\s+-)/i).slice(1);
    for (const chunk of raceChunks) {
      const header = chunk.match(
        /###\s*\d+\s+(\d{1,2}:\d{2})\s+-\s+([^\n]+)/i
      );
      if (!header) continue;

      const time = to24hTime(header[1]);
      const distance = extractDistance(header[2]);
      const name = cleanRaceName(header[2]);

      const runners: AtrParsedRace["runners"] = [];
      let winnerJockey = "";
      let winnerTrainer = "";

      const jockeyMatch = chunk.match(
        /Winning jockey\s*:\s*\*?\*?\s*([^\n*]+)/i
      );
      if (jockeyMatch) winnerJockey = jockeyMatch[1].trim();

      const trainerMatch = chunk.match(
        /Winning trainer\s*:\s*\*?\*?\s*([^\n*]+)/i
      );
      if (trainerMatch) winnerTrainer = trainerMatch[1].trim();

      for (const line of chunk.split("\n")) {
        const place = line.match(
          /(\d+)(?:st|nd|rd|th)\s+\((\d+)\)\s+([A-Za-z][A-Za-z'0-9 -]+?)(?:\s+([\d/]+(?:\s*[FJ2]+)?))?\s*$/i
        );
        if (!place) continue;
        const position = Number(place[1]);
        const horse = place[3].trim();
        if (horse.length < 2) continue;
        const sp = place[4] ? fractionalToDecimal(place[4]) : null;
        runners.push({
          name: horse,
          position,
          sp,
          jockey: position === 1 ? winnerJockey : "",
          trainer: position === 1 ? winnerTrainer : "",
        });
      }

      if (runners.some((r) => r.position === 1)) {
        races.push({
          course,
          time,
          name,
          distance,
          going: "",
          runners,
        });
      }
    }
  }

  return races;
}

function toResultRaces(parsed: AtrParsedRace[], isoDate: string): ResultRace[] {
  return parsed.map((r) => ({
    raceId: `atr-${courseSlug(r.course)}-${isoDate}-${r.time}`,
    date: isoDate,
    course: r.course,
    time: r.time,
    name: r.name || "Race",
    going: r.going,
    distance: r.distance || `${distanceYards(r.distance)}y`,
    distanceYards: distanceYards(r.distance || "0f"),
    runners: r.runners.map((x) => ({
      horseId: "",
      name: x.name,
      position: x.position,
      jockey: x.jockey,
      trainer: x.trainer,
      sp: x.sp,
    })),
  }));
}

async function loadCache(isoDate: string): Promise<ResultRace[] | null> {
  try {
    const raw = await readFile(path.join(CACHE_DIR, `${isoDate}.json`), "utf8");
    const data = JSON.parse(raw) as { races: ResultRace[] };
    return data.races?.length ? data.races : null;
  } catch {
    return null;
  }
}

async function saveCache(isoDate: string, races: ResultRace[]): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    path.join(CACHE_DIR, `${isoDate}.json`),
    JSON.stringify({ savedAt: new Date().toISOString(), races }),
    "utf8"
  );
}

async function fetchDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": FETCH_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.warn(`  atr results: HTTP ${res.status} ${url}`);
      return null;
    }
    const body = await res.text();
    return body.length > 5000 ? body : null;
  } catch (e) {
    console.warn(`  atr results: fetch failed ${url}`, e);
    return null;
  }
}

async function tavilyExtract(url: string): Promise<string | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        urls: [url],
        extract_depth: "basic",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ raw_content?: string }>;
    };
    return data.results?.[0]?.raw_content?.trim() ?? null;
  } catch {
    return null;
  }
}

async function loadPageText(url: string): Promise<string | null> {
  const html = await fetchDirect(url);
  if (html) return html.includes("<html") ? htmlToText(html) : html;
  const extracted = await tavilyExtract(url);
  return extracted;
}

/**
 * Fetch UK/IRE results from At The Races for a calendar date.
 * Uses /results/yesterday when isoDate is yesterday (UK time).
 */
export async function fetchAtrResultsForDate(
  isoDate: string
): Promise<{ races: ResultRace[]; debug: string }> {
  const cached = await loadCache(isoDate);
  if (cached?.length) {
    return { races: cached, debug: `atr cache → ${cached.length} races` };
  }

  const rel = atrPathForDate(isoDate);
  const url = `${ATR_BASE}${rel}`;
  const text = await loadPageText(url);
  if (!text) {
    return { races: [], debug: `atr fetch failed (${rel})` };
  }

  const parsed = parseAtrResultsText(text);
  const races = toResultRaces(parsed, isoDate).filter((r) =>
    r.runners.some((x) => x.position === 1)
  );

  console.log(
    `  atr results: ${races.length} UK/IRE races from ${rel} (${isoDate})`
  );

  if (races.length) await saveCache(isoDate, races);
  return {
    races,
    debug: races.length
      ? `atr ${rel} → ${races.length} races`
      : `atr ${rel} parsed 0 races`,
  };
}
