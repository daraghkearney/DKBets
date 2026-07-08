import type { TipsterPick } from "./types";

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

/** Known high-reputation UK/Irish racing tipster sources to bias searches */
const TRUSTED_SOURCES = [
  "Racing Post",
  "Timeform",
  "At The Races",
  "Sporting Life",
  "Racing TV",
  "Irish Independent racing",
  "Paddy Power blog",
];

export function shouldFetchRacingTipsters(): boolean {
  if (!process.env.TAVILY_API_KEY) return false;
  return process.env.REFRESH_WEB_RESEARCH === "true" || process.env.ENABLE_WEB_RESEARCH === "true";
}

function meetingQuery(meeting: string): string[] {
  const base = meeting.replace(/-/g, " ");
  return [
    `${base} horse racing expert tips proven track record winners today`,
    `reliable horse racing tipster ${base} festival strike rate ROI`,
    `${TRUSTED_SOURCES.slice(0, 3).join(" ")} ${base} best bets selections`,
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
        include_domains: [
          "racingpost.com",
          "timeform.com",
          "attheraces.com",
          "sportinglife.com",
          "skysports.com",
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as TavilyResponse;
  } catch {
    return null;
  }
}

function picksFromResponse(
  meeting: string,
  query: string,
  response: TavilyResponse,
  raceIds: string[]
): TipsterPick[] {
  const picks: TipsterPick[] = [];
  const answer = response.answer?.trim();
  if (answer && answer.length > 40) {
    picks.push({
      id: `tip-answer-${meeting}-${picks.length}`,
      tipster: "Tavily consensus",
      horse: extractHorseName(answer) ?? "See analysis",
      raceId: raceIds[0] ?? "race-1",
      confidence: 0.82,
      trackRecord: "Aggregated from trusted racing publications",
      rationale: answer.slice(0, 480),
    });
  }

  for (const hit of response.results ?? []) {
    const text = (hit.content ?? hit.title ?? "").trim();
    if (text.length < 50) continue;
    const source = hit.title?.split("|")[0]?.trim() ?? "Racing source";
    picks.push({
      id: `tip-${meeting}-${picks.length}`,
      tipster: source.slice(0, 60),
      horse: extractHorseName(text) ?? "Selection in article",
      raceId: raceIds[picks.length % raceIds.length] ?? "race-1",
      confidence: Math.min(0.88, 0.55 + (hit.score ?? 0.3) * 0.4),
      trackRecord: trustedSourceBonus(hit.url ?? ""),
      sourceUrl: hit.url,
      rationale: text.slice(0, 420),
    });
    if (picks.length >= 8) break;
  }

  return picks;
}

function trustedSourceBonus(url: string): string {
  const lower = url.toLowerCase();
  for (const s of TRUSTED_SOURCES) {
    if (lower.includes(s.toLowerCase().replace(/\s/g, ""))) {
      return `High-trust source · ${s}`;
    }
  }
  if (lower.includes("racingpost")) return "High-trust · Racing Post";
  if (lower.includes("timeform")) return "High-trust · Timeform";
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
  if (!shouldFetchRacingTipsters()) return [];

  const queries = meetingQuery(meeting);
  const all: TipsterPick[] = [];

  for (const q of queries) {
    const res = await tavilySearch(q);
    if (res) all.push(...picksFromResponse(meeting, q, res, raceIds));
    await new Promise((r) => setTimeout(r, QUERY_DELAY_MS));
  }

  return all
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}
