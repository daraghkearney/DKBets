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

const TRUSTED_SOURCES = [
  "Racing Post",
  "Timeform",
  "At The Races",
  "Sporting Life",
  "Racing TV",
];

export function isTipsterResearchConfigured(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export function shouldRefreshTipsterResearch(): boolean {
  if (!isTipsterResearchConfigured()) return false;
  if (process.env.ENABLE_WEB_RESEARCH === "true") return true;
  return process.env.REFRESH_WEB_RESEARCH === "true";
}

function meetingQuery(meeting: string): string[] {
  const base = meeting.replace(/-/g, " ");
  const today = new Date().toISOString().slice(0, 10);
  return [
    `UK Ireland horse racing tips ${today} ${base} nap selections`,
    `${TRUSTED_SOURCES.join(" ")} ${base} horse racing best bets today`,
    `reliable horse racing tipster ${base} winners today`,
  ];
}

async function tavilySearch(query: string): Promise<TavilyResponse | null> {
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
        max_results: 5,
        include_answer: true,
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

function picksFromResponse(
  meeting: string,
  response: TavilyResponse,
  raceIds: string[]
): TipsterPick[] {
  const picks: TipsterPick[] = [];

  if (response.answer?.trim() && response.answer.trim().length > 40) {
    picks.push({
      id: `tip-answer-${meeting}-${picks.length}`,
      tipster: "Tavily consensus",
      horse: extractHorseName(response.answer) ?? "See analysis",
      raceId: raceIds[0] ?? "race-1",
      confidence: 0.82,
      trackRecord: "Aggregated from trusted racing publications",
      rationale: response.answer.trim().slice(0, 480),
    });
  }

  for (const hit of response.results ?? []) {
    const text = (hit.content ?? hit.title ?? "").trim();
    if (text.length < 50) continue;
    picks.push({
      id: `tip-${meeting}-${picks.length}`,
      tipster: (hit.title?.split("|")[0]?.trim() ?? "Racing source").slice(0, 60),
      horse: extractHorseName(text) ?? "Selection in article",
      raceId: raceIds[picks.length % raceIds.length] ?? "race-1",
      confidence: Math.min(0.88, 0.55 + (hit.score ?? 0.3) * 0.4),
      trackRecord: trustedSourceBonus(hit.url ?? ""),
      sourceUrl: hit.url,
      rationale: text.slice(0, 420),
    });
    if (picks.length >= 10) break;
  }

  return picks;
}

function trustedSourceBonus(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("racingpost")) return "High-trust · Racing Post";
  if (lower.includes("timeform")) return "High-trust · Timeform";
  if (lower.includes("attheraces")) return "High-trust · At The Races";
  if (lower.includes("sportinglife")) return "High-trust · Sporting Life";
  return "Web-sourced racing analysis";
}

function extractHorseName(text: string): string | null {
  const m = text.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b.*?(?:tip|pick|selection|back|nap)/i
  );
  return m?.[1] ?? null;
}

export async function fetchTipsterIntelligence(
  meeting: string,
  raceIds: string[]
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

  const queries = meetingQuery(meeting);
  const all: TipsterPick[] = [];

  for (const q of queries) {
    const res = await tavilySearch(q);
    if (res) all.push(...picksFromResponse(meeting, res, raceIds));
    await new Promise((r) => setTimeout(r, QUERY_DELAY_MS));
  }

  const picks = all.sort((a, b) => b.confidence - a.confidence).slice(0, 12);
  if (picks.length) {
    await saveCachedTipsters(meeting, picks);
    console.log(`  racing tipsters: ${meeting} — ${picks.length} signals`);
  }

  return picks.length ? picks : (cached ?? []);
}
