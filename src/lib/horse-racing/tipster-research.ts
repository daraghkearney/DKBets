import type { TipsterPick } from "./types";
import {
  loadCachedTipsters,
  saveCachedTipsters,
} from "./tipster-cache";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  answer?: string;
  results?: TavilyResult[];
}

const QUERY_DELAY_MS = 500;

/**
 * Mainstream outlets are excluded from insider searches — their tips are
 * already priced into the market. We hunt independent tipsters, stable
 * whispers and forum intelligence instead.
 */
const MAINSTREAM_DOMAINS = [
  "racingpost.com",
  "timeform.com",
  "attheraces.com",
  "sportinglife.com",
  "skysports.com",
  "bbc.co.uk",
  "bbc.com",
  "itv.com",
  "paddypower.com",
  "betfair.com",
  "williamhill.com",
  "ladbrokes.com",
  "oddschecker.com",
];

export function isTipsterResearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export function shouldRefreshTipsterResearch(): boolean {
  if (!isTipsterResearchConfigured()) return false;
  if (process.env.ENABLE_WEB_RESEARCH === "true") return true;
  return process.env.REFRESH_WEB_RESEARCH === "true";
}

export interface TipsterResearchContext {
  /** Course names racing today, e.g. ["Leopardstown", "Ascot"] */
  courses?: string[];
}

function insiderQueries(
  meeting: string,
  ctx: TipsterResearchContext
): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const courseText = (ctx.courses ?? []).slice(0, 4).join(" ");
  const where = courseText || meeting.replace(/-/g, " ");
  return [
    `horse racing insider whispers stable tips today ${today} ${where}`,
    `independent horse racing tipster high strike rate proven record nap today ${where}`,
    `well backed gamble horses today market movers ${today} ${where}`,
    `racing forum tips today members selections ${where}`,
    `each way value tips today small independent tipster ${today}`,
  ];
}

async function tavilySearch(
  query: string,
  excludeMainstream: boolean
): Promise<TavilyResponse | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "advanced",
        max_results: 6,
        include_answer: true,
        ...(excludeMainstream ? { exclude_domains: MAINSTREAM_DOMAINS } : {}),
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.warn(`  racing tipsters: Tavily ${res.status}`);
      return null;
    }
    return (await res.json()) as TavilyResponse;
  } catch (e) {
    console.warn("  racing tipsters: fetch failed", e);
    return null;
  }
}

/** Pull a stated strike rate or win record out of tipster copy. */
function extractTrackRecord(text: string): {
  label: string;
  boost: number;
} {
  const sr = text.match(/(\d{1,2}(?:\.\d)?)\s?%\s*(?:strike\s*rate|SR\b|win\s*rate)/i);
  if (sr) {
    const rate = Number(sr[1]);
    if (rate >= 25)
      return { label: `Claimed ${rate}% strike rate — elite`, boost: 0.15 };
    if (rate >= 18)
      return { label: `Claimed ${rate}% strike rate — strong`, boost: 0.08 };
    return { label: `Claimed ${rate}% strike rate`, boost: 0 };
  }
  const wins = text.match(/(\d+)\s*winners?\s*(?:from|in|out of)\s*(\d+)/i);
  if (wins) {
    const rate = Number(wins[1]) / Math.max(1, Number(wins[2]));
    if (rate >= 0.25)
      return {
        label: `${wins[1]} winners from ${wins[2]} — proven record`,
        boost: 0.12,
      };
    return { label: `${wins[1]} winners from ${wins[2]}`, boost: 0.04 };
  }
  if (/insider|whisper|stable|gallop|yard/i.test(text)) {
    return { label: "Insider/stable intelligence", boost: 0.06 };
  }
  return { label: "Independent racing source", boost: 0 };
}

function isMainstreamUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return MAINSTREAM_DOMAINS.some((d) => lower.includes(d));
}

function extractHorseName(text: string): string | null {
  const patterns = [
    // "back Golden Trail", "nap: Golden Trail", "tip is Golden Trail"
    /(?:back|nap[:\s]+|tip(?:\s+is)?[:\s]+|selection[:\s]+|fancied)\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,3})/,
    // "Golden Trail is the pick/tip/nap"
    /\b([A-Z][a-z']+(?:\s+[A-Z][a-z']+){0,3})\b[^.]{0,40}?(?:is the (?:nap|pick|tip|selection)|looks the bet|can win)/,
    // fallback: capitalised phrase near tip words
    /\b([A-Z][a-z']+(?:\s+[A-Z][a-z']+){0,3})\b.*?(?:tip|pick|selection|back|nap)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1] && m[1].length >= 4) return m[1];
  }
  return null;
}

function picksFromResponse(
  meeting: string,
  response: TavilyResponse,
  raceIds: string[],
  startIndex: number
): TipsterPick[] {
  const picks: TipsterPick[] = [];

  if (response.answer?.trim() && response.answer.trim().length > 40) {
    const record = extractTrackRecord(response.answer);
    picks.push({
      id: `tip-answer-${meeting}-${startIndex + picks.length}`,
      tipster: "Insider consensus",
      horse: extractHorseName(response.answer) ?? "See analysis",
      raceId: raceIds[0] ?? "race-1",
      confidence: Math.min(0.92, 0.78 + record.boost),
      trackRecord: record.label,
      rationale: response.answer.trim().slice(0, 480),
    });
  }

  for (const hit of response.results ?? []) {
    const text = (hit.content ?? hit.title ?? "").trim();
    if (text.length < 50) continue;
    const record = extractTrackRecord(`${hit.title ?? ""} ${text}`);
    const mainstream = isMainstreamUrl(hit.url ?? "");
    picks.push({
      id: `tip-${meeting}-${startIndex + picks.length}`,
      tipster: (hit.title?.split(/[|–-]/)[0]?.trim() ?? "Racing source").slice(0, 60),
      horse: extractHorseName(text) ?? "Selection in article",
      raceId: raceIds[picks.length % Math.max(1, raceIds.length)] ?? "race-1",
      confidence: Math.min(
        0.92,
        (mainstream ? 0.45 : 0.55) + (hit.score ?? 0.3) * 0.35 + record.boost
      ),
      trackRecord: mainstream
        ? `Mainstream — context only · ${record.label}`
        : record.label,
      sourceUrl: hit.url,
      rationale: text.slice(0, 420),
    });
    if (picks.length >= 12) break;
  }

  return picks;
}

export async function fetchTipsterIntelligence(
  meeting: string,
  raceIds: string[],
  ctx: TipsterResearchContext = {}
): Promise<TipsterPick[]> {
  if (!isTipsterResearchConfigured()) return [];

  const cached = await loadCachedTipsters(meeting);
  if (cached?.length && !shouldRefreshTipsterResearch()) {
    console.log(`  racing tipsters: cache hit ${meeting} (${cached.length})`);
    return cached;
  }
  if (cached?.length && shouldRefreshTipsterResearch()) {
    console.log(`  racing tipsters: refreshing ${meeting} …`);
  }

  if (!shouldRefreshTipsterResearch()) {
    return cached ?? [];
  }

  const queries = insiderQueries(meeting, ctx);
  const all: TipsterPick[] = [];

  for (const q of queries) {
    const res = await tavilySearch(q, true);
    if (res) all.push(...picksFromResponse(meeting, res, raceIds, all.length));
    await new Promise((r) => setTimeout(r, QUERY_DELAY_MS));
  }

  const picks = all.sort((a, b) => b.confidence - a.confidence).slice(0, 18);
  if (picks.length) {
    await saveCachedTipsters(meeting, picks);
    console.log(`  racing tipsters: ${meeting} — ${picks.length} insider signals`);
  }

  return picks.length ? picks : (cached ?? []);
}
