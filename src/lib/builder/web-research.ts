import type { ContextInsight, MatchContextReport } from "./context-types";
import type { LegCategory } from "./types";
import type { DuelContextReport } from "./context-types";
import {
  loadCachedWebResearch,
  saveCachedWebResearch,
} from "./web-research-cache";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  query?: string;
  answer?: string;
  results?: TavilyResult[];
}

type QueryKind = "preview" | "h2h" | "duel";

interface ResearchQuery {
  id: string;
  kind: QueryKind;
  query: string;
  title: string;
  playerNames?: string[];
  matchupSlot?: string;
}

const QUERY_DELAY_MS = 400;

export function isWebResearchConfigured(): boolean {
  if (!process.env.TAVILY_API_KEY) return false;
  return process.env.ENABLE_WEB_RESEARCH !== "false";
}

/** Whether this export should call Tavily (vs cache-only). */
export function shouldRefreshWebResearch(): boolean {
  if (!isWebResearchConfigured()) return false;
  if (process.env.ENABLE_WEB_RESEARCH === "true") return true;
  return process.env.REFRESH_WEB_RESEARCH === "true";
}

/** @deprecated Use shouldRefreshWebResearch */
export function shouldFetchWebResearch(): boolean {
  return shouldRefreshWebResearch();
}

function inferCategories(text: string): LegCategory[] {
  const lower = text.toLowerCase();
  const cats = new Set<LegCategory>();
  if (/foul|card|yellow|booking/.test(lower)) {
    cats.add("fouls");
    cats.add("cards");
  }
  if (/fouled|fouls won|drawn/.test(lower)) cats.add("foulsWon");
  if (/tackle/.test(lower)) cats.add("tackles");
  if (/shot on target|sot|on target/.test(lower)) cats.add("sot");
  if (/shot|shoot|xG|chance/.test(lower)) cats.add("shots");
  if (/corner|set piece|cross/.test(lower)) cats.add("team");
  if (/formation|tactic|lineup|press|block/.test(lower)) {
    cats.add("team");
    cats.add("shots");
  }
  if (!cats.size) cats.add("shots");
  return [...cats];
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
}

function buildQueries(
  home: string,
  away: string,
  duels: DuelContextReport[]
): ResearchQuery[] {
  const year = new Date().getFullYear();
  const queries: ResearchQuery[] = [
    {
      id: "preview",
      kind: "preview",
      query: `${home} vs ${away} World Cup ${year} tactical preview formation style of play`,
      title: "Tactical preview",
    },
    {
      id: "h2h",
      kind: "h2h",
      query: `${home} vs ${away} recent head to head form World Cup`,
      title: "Recent form & H2H",
    },
  ];

  const topDuels = duels
    .filter((d) => d.careerMeetings >= 1 || d.isRivalry)
    .sort((a, b) => b.careerMeetings - a.careerMeetings)
    .slice(0, 2);

  for (const d of topDuels) {
    queries.push({
      id: `duel-${slug(d.playerA)}-${slug(d.playerB)}`,
      kind: "duel",
      query: `${d.playerA} vs ${d.playerB} fouls tackles history club international`,
      title: `${d.playerA} vs ${d.playerB}`,
      playerNames: [d.playerA, d.playerB],
      matchupSlot: d.slot,
    });
  }

  return queries;
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
        search_depth: "basic",
        max_results: 4,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`  web research: Tavily ${res.status} for "${query.slice(0, 50)}…"`);
      return null;
    }
    return (await res.json()) as TavilyResponse;
  } catch (e) {
    console.warn(`  web research: fetch failed —`, e);
    return null;
  }
}

function insightFromQuery(
  rq: ResearchQuery,
  response: TavilyResponse,
  matchId: number
): ContextInsight[] {
  const out: ContextInsight[] = [];
  const kind =
    rq.kind === "duel"
      ? "web_duel"
      : rq.kind === "h2h"
        ? "web_h2h"
        : "web_preview";

  if (response.answer?.trim()) {
    const body = response.answer.trim().slice(0, 480);
    out.push({
      id: `web-${matchId}-${rq.id}-answer`,
      kind,
      source: "web",
      title: rq.title,
      body,
      confidence: 0.78,
      categories: inferCategories(body),
      playerNames: rq.playerNames,
      matchupSlot: rq.matchupSlot,
    });
  }

  for (const [i, hit] of (response.results ?? []).slice(0, 2).entries()) {
    const snippet = (hit.content ?? hit.title ?? "").trim();
    if (!snippet || snippet.length < 40) continue;
    out.push({
      id: `web-${matchId}-${rq.id}-hit-${i}`,
      kind,
      source: "web",
      sourceUrl: hit.url,
      title: hit.title?.slice(0, 80) ?? rq.title,
      body: snippet.slice(0, 420),
      confidence: Math.min(0.72, 0.52 + (hit.score ?? 0.3) * 0.35),
      categories: inferCategories(snippet),
      playerNames: rq.playerNames,
      matchupSlot: rq.matchupSlot,
    });
  }

  return out;
}

async function fetchInsightsForMatch(
  matchId: number,
  home: string,
  away: string,
  duels: DuelContextReport[],
  options: { allowNetwork?: boolean } = {}
): Promise<ContextInsight[]> {
  const cached = await loadCachedWebResearch(matchId);
  if (cached?.length) {
    console.log(`  web research: cache hit match ${matchId} (${cached.length} insights)`);
    return cached;
  }

  if (!options.allowNetwork) {
    return [];
  }

  const queries = buildQueries(home, away, duels);
  const insights: ContextInsight[] = [];

  for (const rq of queries) {
    const response = await tavilySearch(rq.query);
    if (response) {
      insights.push(...insightFromQuery(rq, response, matchId));
    }
    await new Promise((r) => setTimeout(r, QUERY_DELAY_MS));
  }

  if (insights.length) {
    await saveCachedWebResearch(matchId, insights);
    console.log(
      `  web research: match ${matchId} — ${insights.length} insights from ${queries.length} queries`
    );
  }

  return insights;
}

/** Merge Tavily web research into an existing FotMob context report. */
export async function augmentMatchContextWithWeb(
  report: MatchContextReport
): Promise<MatchContextReport> {
  if (!isWebResearchConfigured()) return report;

  const [home, away] = report.matchLabel.split(" v ");
  if (!home || !away) return report;

  const webInsights = await fetchInsightsForMatch(
    report.matchId,
    home.trim(),
    away.trim(),
    report.duels,
    { allowNetwork: shouldRefreshWebResearch() }
  );

  if (!webInsights.length) return report;

  const merged = [...report.insights, ...webInsights].sort(
    (a, b) => b.confidence - a.confidence
  );

  return {
    ...report,
    webResearchAvailable: true,
    summary: `${report.summary.replace(/\.$/, "")} · ${webInsights.length} research source${webInsights.length === 1 ? "" : "s"} added.`,
    insights: merged.slice(0, 20),
  };
}
