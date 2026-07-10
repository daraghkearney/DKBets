import type { TipsterPick } from "./types";
import {
  loadCachedTipsters,
  saveCachedTipsters,
} from "./tipster-cache";
import { isInsiderGradePick, isMainstreamTipster } from "./tipster-priority";

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
 * already priced into the market. We hunt elite paid services (often
 * leaked by members on social platforms), independent tipsters and
 * stable whispers instead.
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

const SOCIAL_DOMAINS = ["reddit.com", "x.com", "twitter.com", "threads.net"];

/**
 * Elite/high-hit-rate tipsters and paid services whose picks members
 * often leak publicly. A pick attributed to one of these (and matched
 * to an actual runner) is flagged red-hot.
 */
const ELITE_TIPSTERS = [
  "Pro Sports Advice",
  "PSA",
  "Hugh Taylor",
  "Andy Holding",
  "Patrick Veitch",
  "Racing Consultants",
  "The Value Bettor",
  "Northern Monkey",
  "Mark Howard",
  "Billingpointers",
  "Top Prognosticator",
  "Racing Gold",
  "Templegate",
  "Naps Table",
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
  /** Runner names on today's cards — used to validate extracted picks */
  runnerNames?: string[];
}

interface ResearchQuery {
  query: string;
  domains?: "social" | "no-mainstream";
  platform: string;
}

function buildQueries(ctx: TipsterResearchContext): ResearchQuery[] {
  const today = new Date().toISOString().slice(0, 10);
  const courseText = (ctx.courses ?? []).slice(0, 6).join(" ");
  const where = courseText || "UK Ireland";
  return [
    {
      query: `"Pro Sports Advice" OR PSA horse racing tip today ${today} leaked shared`,
      domains: "social",
      platform: "leak",
    },
    {
      query: `horse racing nap today ${today} ${ELITE_TIPSTERS.slice(2, 6).map((t) => `"${t}"`).join(" OR ")}`,
      domains: "no-mainstream",
      platform: "web",
    },
    {
      query: `reddit horse racing tips today ${today} ${where} nap best bet`,
      domains: "social",
      platform: "reddit",
    },
    {
      query: `horse racing insider whispers stable tips well backed today ${today} ${where}`,
      domains: "no-mainstream",
      platform: "web",
    },
    {
      query: `horse racing telegram tip leak channel nap today ${today} UK Ireland`,
      domains: "social",
      platform: "leak",
    },
    {
      query: `twitter X horse racing nap whisper stable gamble steamer today ${today} ${where}`,
      domains: "social",
      platform: "twitter",
    },
    {
      query: `independent horse racing tipster high strike rate proven record tips today ${where}`,
      domains: "no-mainstream",
      platform: "web",
    },
    {
      query: `"Hugh Taylor" OR "Patrick Veitch" OR "Andy Holding" horse racing tip nap today ${today}`,
      domains: "no-mainstream",
      platform: "web",
    },
    {
      query: `horse racing stable gamble market mover steamer big money today ${today} ${where}`,
      domains: "no-mainstream",
      platform: "web",
    },
  ];
}

async function tavilySearch(q: ResearchQuery): Promise<TavilyResponse | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: q.query,
        search_depth: "advanced",
        max_results: 6,
        include_answer: true,
        ...(q.domains === "social"
          ? { include_domains: SOCIAL_DOMAINS }
          : { exclude_domains: MAINSTREAM_DOMAINS }),
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

// ---------------------------------------------------------------- filtering

/** Strip scraped-page junk (nav crumbs, markdown headers, pipes). */
function cleanSnippet(text: string): string {
  return text
    .replace(/#{2,}/g, " ")
    .replace(/\s*\|+\s*/g, " · ")
    .replace(/-{3,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Reject navigation chrome, sales pages and content-free snippets. */
function isMeaningful(text: string): boolean {
  if (text.length < 60) return false;
  const junkHits = (
    text.match(
      /buy tips|view profile|view tipster|sign up|subscribe|join now|log in|cookie|privacy policy|terms of use|©/gi
    ) ?? []
  ).length;
  if (junkHits >= 2) return false;
  // Require some actual sentence structure
  const words = text.split(/\s+/).length;
  if (words < 12) return false;
  const separators = (text.match(/·/g) ?? []).length;
  if (separators > words / 4) return false;
  return true;
}

/** Pull a stated strike rate or win record out of tipster copy. */
function extractTrackRecord(text: string): {
  label: string;
  boost: number;
  elite: boolean;
} {
  const sr = text.match(
    /(\d{1,2}(?:\.\d)?)\s?%\s*(?:strike\s*rate|SR\b|win\s*rate)/i
  );
  if (sr) {
    const rate = Number(sr[1]);
    if (rate >= 25)
      return {
        label: `Claimed ${rate}% strike rate — elite`,
        boost: 0.15,
        elite: true,
      };
    if (rate >= 18)
      return {
        label: `Claimed ${rate}% strike rate — strong`,
        boost: 0.08,
        elite: false,
      };
    return { label: `Claimed ${rate}% strike rate`, boost: 0, elite: false };
  }
  const wins = text.match(/(\d+)\s*winners?\s*(?:from|in|out of)\s*(\d+)/i);
  if (wins) {
    const rate = Number(wins[1]) / Math.max(1, Number(wins[2]));
    if (rate >= 0.25)
      return {
        label: `${wins[1]} winners from ${wins[2]} — proven record`,
        boost: 0.12,
        elite: true,
      };
    return { label: `${wins[1]} winners from ${wins[2]}`, boost: 0.04, elite: false };
  }
  if (/insider|whisper|stable|gallop|yard/i.test(text)) {
    return { label: "Insider/stable intelligence", boost: 0.06, elite: false };
  }
  return { label: "Independent racing source", boost: 0, elite: false };
}

function eliteTipsterMentioned(text: string): string | null {
  for (const name of ELITE_TIPSTERS) {
    const pattern =
      name === "PSA"
        ? /\bPSA\b/
        : new RegExp(name.replace(/\s+/g, "\\s+"), "i");
    if (pattern.test(text)) return name;
  }
  return null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find which of today's actual runners is named in the text. Much more
 * reliable than regex-guessing horse names from prose.
 */
function findRunnerInText(
  text: string,
  runnerNames: string[]
): string | null {
  const haystack = ` ${normalizeName(text)} `;
  let best: string | null = null;
  for (const name of runnerNames) {
    const needle = normalizeName(name);
    if (needle.length < 5) continue;
    if (haystack.includes(` ${needle} `)) {
      // Prefer the longest match (avoids partial-name collisions)
      if (!best || needle.length > normalizeName(best).length) best = name;
    }
  }
  return best;
}

function extractHorseName(text: string): string | null {
  const patterns = [
    /(?:back|nap[:\s]+|tip(?:\s+is)?[:\s]+|selection[:\s]+|fancied)\s+([A-Z][A-Za-z']+(?:\s+[A-Z][A-Za-z']+){0,3})/,
    /\b([A-Z][a-z']+(?:\s+[A-Z][a-z']+){0,3})\b[^.]{0,40}?(?:is the (?:nap|pick|tip|selection)|looks the bet|can win)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1] && m[1].length >= 4) return m[1];
  }
  return null;
}

function detectPlatform(url: string, fallback: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("reddit.com")) return "reddit";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "twitter";
  return fallback;
}

function picksFromResponse(
  meeting: string,
  q: ResearchQuery,
  response: TavilyResponse,
  ctx: TipsterResearchContext,
  startIndex: number
): TipsterPick[] {
  const picks: TipsterPick[] = [];
  const runnerNames = ctx.runnerNames ?? [];

  const candidates: Array<{
    text: string;
    title: string;
    url?: string;
    score: number;
  }> = [];

  if (response.answer?.trim()) {
    candidates.push({
      text: response.answer.trim(),
      title: "Consensus",
      score: 0.6,
    });
  }
  for (const hit of response.results ?? []) {
    candidates.push({
      text: (hit.content ?? hit.title ?? "").trim(),
      title: hit.title ?? "Racing source",
      url: hit.url,
      score: hit.score ?? 0.3,
    });
  }

  for (const c of candidates) {
    const text = cleanSnippet(c.text);
    if (!isMeaningful(text)) continue;

    const combined = `${c.title} ${text}`;
    const record = extractTrackRecord(combined);
    const elite = eliteTipsterMentioned(combined);

    // Prefer verified runner names over regex guessing
    const matchedRunner = runnerNames.length
      ? findRunnerInText(text, runnerNames)
      : null;
    const horse = matchedRunner ?? extractHorseName(text);
    if (!horse) continue;

    const platform = detectPlatform(c.url ?? "", q.platform);
    const mainstreamUrl = MAINSTREAM_DOMAINS.some((d) =>
      (c.url ?? "").toLowerCase().includes(d)
    );
    if (mainstreamUrl && !elite && !record.elite && platform !== "leak") {
      continue;
    }

    const hot = Boolean(
      matchedRunner &&
        (elite ||
          record.elite ||
          platform === "leak" ||
          /insider|whisper|stable|gamble|steamer/i.test(combined))
    );

    const tipsterName =
      elite ??
      cleanSnippet(c.title.split(/[|–—-]/)[0] ?? "").slice(0, 50) ??
      "Racing source";

    const pick: TipsterPick = {
      id: `tip-${meeting}-${startIndex + picks.length}`,
      tipster: tipsterName || "Racing source",
      horse,
      raceId: "",
      confidence: Math.min(
        0.95,
        0.5 +
          c.score * 0.25 +
          record.boost +
          (elite ? 0.12 : 0) +
          (matchedRunner ? 0.08 : 0)
      ),
      trackRecord: elite
        ? `Elite tipster · ${record.label}`
        : record.label,
      sourceUrl: c.url,
      rationale: text.slice(0, 420),
      hot,
      platform,
      matchedRunner: matchedRunner ?? undefined,
    };
    if (!isInsiderGradePick(pick) && isMainstreamTipster(tipsterName) && !elite) {
      continue;
    }
    picks.push(pick);
    if (picks.length >= 8) break;
  }

  return picks;
}

function dedupePicks(picks: TipsterPick[]): TipsterPick[] {
  const seen = new Map<string, TipsterPick>();
  for (const p of picks) {
    const key = normalizeName(p.horse);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, p);
    } else {
      // Same horse from multiple sources — keep the strongest, bump confidence
      const keep = existing.confidence >= p.confidence ? existing : p;
      keep.confidence = Math.min(0.97, Math.max(existing.confidence, p.confidence) + 0.05);
      keep.hot = existing.hot || p.hot;
      keep.trackRecord = `${keep.trackRecord} · multiple sources`;
      seen.set(key, keep);
    }
  }
  return [...seen.values()];
}

export async function fetchTipsterIntelligence(
  meeting: string,
  raceIds: string[],
  ctx: TipsterResearchContext = {}
): Promise<TipsterPick[]> {
  void raceIds;
  if (!isTipsterResearchConfigured()) return [];

  const cached = await loadCachedTipsters(meeting);

  // If new meetings appeared since the cache was built (e.g. Irish cards
  // arriving later), the cached research never covered them — force a
  // refresh even outside a scheduled research window.
  const currentCourses = (ctx.courses ?? []).map((c) => normalizeName(c));
  const cachedCourses = (cached?.courses ?? []).map((c) => normalizeName(c));
  const missingCourses = currentCourses.filter(
    (c) => !cachedCourses.includes(c)
  );
  const staleCoverage = Boolean(cached && missingCourses.length);
  const cacheEmpty = !cached?.picks?.length;
  const mustResearch =
    shouldRefreshTipsterResearch() || staleCoverage || cacheEmpty;

  if (cached && !mustResearch) {
    console.log(
      `  racing tipsters: cache hit ${meeting} (${cached.picks.length})`
    );
    return cached.picks;
  }
  if (staleCoverage) {
    console.log(
      `  racing tipsters: cache missing courses [${missingCourses.join(", ")}] — refreshing`
    );
  } else if (cacheEmpty) {
    console.log(`  racing tipsters: no cache for ${meeting} — running research`);
  }

  const queries = mustResearch && !shouldRefreshTipsterResearch()
    ? buildQueries(ctx).slice(0, 4)
    : buildQueries(ctx);
  const all: TipsterPick[] = [];

  for (const q of queries) {
    const res = await tavilySearch(q);
    if (res) all.push(...picksFromResponse(meeting, q, res, ctx, all.length));
    await new Promise((r) => setTimeout(r, QUERY_DELAY_MS));
  }

  const picks = dedupePicks(all)
    .sort((a, b) => Number(b.hot ?? false) - Number(a.hot ?? false) || b.confidence - a.confidence)
    .slice(0, 16);

  const hotCount = picks.filter((p) => p.hot).length;
  if (picks.length) {
    await saveCachedTipsters(meeting, picks, ctx.courses ?? []);
    console.log(
      `  racing tipsters: ${meeting} — ${picks.length} verified signals (${hotCount} red-hot)`
    );
  }

  return picks.length ? picks : (cached?.picks ?? []);
}
