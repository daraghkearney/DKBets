/**
 * Fetch today's tips from curated league sources (Tipster League, OLBG,
 * betHQ, Betting Gods) and convert them into TipsterPick entries weighted
 * by the tipster registry strike rates.
 */
import { normalizeHorseName } from "./model";
import {
  bethqFetchSlugs,
  formatTrackRecord,
  LEAGUE_FEED_URLS,
  lookupRegisteredTipster,
  REGISTERED_TIPSTERS,
  tierConfidenceBoost,
  tierIsHotEligible,
  type RegisteredTipster,
} from "./tipster-registry";
import type { TipsterPick } from "./types";

const FETCH_UA =
  "Mozilla/5.0 (compatible; Statmanac/1.0; +https://statmanac.com)";
const FETCH_TIMEOUT_MS = 20_000;

export interface LeagueFeedContext {
  runnerNames?: string[];
  courses?: string[];
}

interface RawTip {
  horse: string;
  tipster: string;
  course?: string;
  time?: string;
  rationale: string;
  sourceUrl: string;
  platform: string;
  consensusPct?: number;
  expertCount?: number;
  steamerPct?: number;
  registered?: RegisteredTipster | null;
}

// ------------------------------------------------------------------ fetch

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": FETCH_UA, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`  league feeds: HTTP ${res.status} ${url}`);
      return null;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
      const j = await res.json();
      return typeof j === "string" ? j : JSON.stringify(j);
    }
    return await res.text();
  } catch (e) {
    console.warn(`  league feeds: fetch failed ${url}`, e);
    return null;
  }
}

/** HTML → rough plain text for regex parsers. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
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
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ url?: string; raw_content?: string }>;
    };
    return data.results?.[0]?.raw_content?.trim() ?? null;
  } catch {
    return null;
  }
}

async function loadPage(url: string): Promise<{ raw: string; text: string } | null> {
  const raw = await fetchText(url);
  if (raw && raw.length > 400) {
    const text = raw.includes("<html") ? htmlToText(raw) : raw;
    return { raw, text };
  }
  const extracted = await tavilyExtract(url);
  if (!extracted) return null;
  return { raw: extracted, text: extracted };
}

// ---------------------------------------------------------------- parsers

/** OLBG Svelte payload embeds tips as JSON fragments in the HTML. */
function parseOlbgHtml(html: string, sourceUrl: string): RawTip[] {
  const tips: RawTip[] = [];
  const re =
    /selection:"([^"]+)"[^}]*?event_name_alias:"([^"]+)"[^}]*?win_tips:(\d+)[^}]*?win_tips_count:(\d+)/g;
  for (const m of html.matchAll(re)) {
    const horse = m[1].trim();
    const alias = m[2].trim();
    const parts = alias.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
    if (!parts || horse.length < 3) continue;
    const winTips = Number(m[3]);
    const winTotal = Number(m[4]);
    const pct = winTotal ? Math.round((winTips / winTotal) * 100) : undefined;
    tips.push({
      horse,
      tipster: "OLBG consensus",
      course: parts[2].trim(),
      time: parts[1],
      rationale: `OLBG ${winTips}/${winTotal} tipsters back ${horse} at ${alias}`,
      sourceUrl,
      platform: "olbg",
      consensusPct: pct,
      expertCount: winTips,
      registered: null,
    });
  }
  return tips;
}

function parseOlbgTips(text: string, sourceUrl: string): RawTip[] {
  const tips: RawTip[] = [];
  const blocks = text.split(/(?=#####\s+\d{1,2}:\d{2}\s)/);
  for (const block of blocks) {
    const header = block.match(/#####\s+(\d{1,2}:\d{2})\s+([A-Za-z][A-Za-z' -]+)/);
    const horse = block.match(/\n####\s+([A-Za-z][A-Za-z'0-9 -]+)/);
    if (!header || !horse) continue;
    const winTips = block.match(/(\d+)\/(\d+)\s+Win Tips/i);
    const pct = block.match(/(\d{1,3})%/);
    const experts = block.match(/(\d+)\s+experts?/i);
    const horseName = horse[1].trim();
    if (horseName.length < 3) continue;
    tips.push({
      horse: horseName,
      tipster: "OLBG consensus",
      course: header[2].trim(),
      time: header[1],
      rationale: winTips
        ? `OLBG ${winTips[1]}/${winTips[2]} tipsters back ${horseName} at ${header[1]} ${header[2]}`
        : `OLBG tip for ${horseName} at ${header[1]} ${header[2]}`,
      sourceUrl,
      platform: "olbg",
      consensusPct: pct ? Number(pct[1]) : undefined,
      expertCount: experts ? Number(experts[1]) : undefined,
      registered: null,
    });
  }
  return tips;
}

function parseTipsterLeagueNap(text: string, sourceUrl: string): RawTip[] {
  // Markdown from Tavily / plain text
  const horse = text.match(
    /Today's NAP[\s\S]{0,200}?\n+([A-Z][A-Za-z' -]+)\n+(\d{1,2}:\d{2})\s+([A-Za-z][A-Za-z' -]+)/i
  );
  if (horse) {
    return [
      {
        horse: horse[1].trim(),
        tipster: "The Tipster League · Nap of the Day",
        course: horse[3].trim(),
        time: horse[2],
        rationale: `Platform nap — most tipped horse still to run (${horse[2]} ${horse[3]})`,
        sourceUrl,
        platform: "tipster-league",
        registered: lookupRegisteredTipster("Chicken Farmer Tips"),
      },
    ];
  }
  // HTML nap block — horse in <p> then time + course nearby
  const napHtml = text.match(
    />([A-Z][A-Za-z]+(?:\s+(?:And\s+)?[A-Za-z]+)+)<\/p>[\s\S]{0,600}?(\d{1,2}:\d{2})[\s\S]{0,200}?(Hamilton|Newmarket|Ascot|York|Chester|Navan|Limerick|Salisbury)/i
  );
  if (napHtml) {
    const h = napHtml[1].trim();
    if (
      h.length >= 4 &&
      !/today|saturday|sunday|returns|bet365|nap of|tipster league/i.test(h)
    ) {
      return [
        {
          horse: h,
          tipster: "The Tipster League · Nap of the Day",
          course: napHtml[3],
          time: napHtml[2],
          rationale: `Tipster League nap at ${napHtml[2]} ${napHtml[3]}`,
          sourceUrl,
          platform: "tipster-league",
          registered: lookupRegisteredTipster("Chicken Farmer Tips"),
        },
      ];
    }
  }
  return [];
}

function parseTipsterLeagueLucky15(text: string, sourceUrl: string): RawTip[] {
  const tips: RawTip[] = [];
  const rows = text.matchAll(
    /\|\s*([A-Za-z][A-Za-z'0-9 -]+)\s+Race\s+(\d{1,2}:\d{2})\s+([A-Za-z][A-Za-z' -]+)\s*\|\s*([\d/]+)\s*\|/gi
  );
  for (const m of rows) {
    tips.push({
      horse: m[1].trim(),
      tipster: "The Tipster League · Lucky 15",
      course: m[3].trim(),
      time: m[2],
      rationale: `Lucky 15 selection at ${m[2]} ${m[3]} (${m[4]}) — course-specialist algorithm`,
      sourceUrl,
      platform: "tipster-league",
      registered: lookupRegisteredTipster("Racing Tictac"),
    });
  }
  // HTML table cells: "St Anton Race 2:52 Newmarket"
  const htmlRows = text.matchAll(
    /([A-Z][A-Za-z'0-9 -]{2,30})\s+Race\s+(\d{1,2}:\d{2})\s+([A-Za-z][A-Za-z' -]+)/gi
  );
  for (const m of htmlRows) {
    if (tips.some((t) => normalizeHorseName(t.horse) === normalizeHorseName(m[1]))) continue;
    tips.push({
      horse: m[1].trim(),
      tipster: "The Tipster League · Lucky 15",
      course: m[3].trim(),
      time: m[2],
      rationale: `Lucky 15 pick at ${m[2]} ${m[3]}`,
      sourceUrl,
      platform: "tipster-league",
      registered: lookupRegisteredTipster("Racing Tictac"),
    });
  }
  return tips;
}

function parseTipsterLeagueSteamers(text: string, sourceUrl: string): RawTip[] {
  const tips: RawTip[] = [];
  const section = text.split("Today's Steamers")[1]?.split("Today's Drifters")[0] ?? "";
  const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 2; i++) {
    const name = lines[i];
    const timeCourse = lines[i + 1]?.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
    const pct = lines[i + 2]?.match(/^([\d.]+)%$/);
    if (!timeCourse || !/^[A-Z]/.test(name) || name.length < 4) continue;
    if (/something|today|since|steamers/i.test(name)) continue;
    tips.push({
      horse: name,
      tipster: "The Tipster League · Market Movers",
      course: timeCourse[2].trim(),
      time: timeCourse[1],
      rationale: `Steamer — price shortened ${pct?.[1] ?? "?"}% since morning`,
      sourceUrl,
      platform: "tipster-league",
      steamerPct: pct ? Number(pct[1]) : undefined,
    });
    i += 2;
  }
  return tips.slice(0, 10);
}

function parseBethqNap(text: string, sourceUrl: string): RawTip[] {
  const tips: RawTip[] = [];
  const tipDay = text.match(
    /Tip Of The Day[\s\S]{0,300}?###\s+([A-Za-z][A-Za-z'0-9 -]+)\n+(\d{1,2}:\d{2})\s+([A-Za-z][A-Za-z' -]+)\s+(\d+)\s+Tipsters?/i
  );
  if (tipDay) {
    tips.push({
      horse: tipDay[1].trim(),
      tipster: "betHQ · Tip of the Day",
      course: tipDay[3].trim(),
      time: tipDay[2],
      rationale: `betHQ consensus — ${tipDay[4]} tipsters on ${tipDay[1]}`,
      sourceUrl,
      platform: "bethq",
      expertCount: Number(tipDay[4]),
    });
  }
  return tips;
}

function parseBethqTipsterPage(
  text: string,
  sourceUrl: string,
  registered: RegisteredTipster
): RawTip[] {
  const row = text.match(
    /Today's Tip[\s\S]{0,400}?\|\s*([A-Za-z][A-Za-z'0-9 -]+)\s*\|\s*(\d{1,2}:\d{2})\s*\|\s*([A-Za-z][A-Za-z' -]+)\s*\|/i
  );
  if (row) {
    return [
      {
        horse: row[1].trim(),
        tipster: registered.name,
        course: row[3].trim(),
        time: row[2],
        rationale: `${registered.name} nap at ${row[2]} ${row[3]}`,
        sourceUrl,
        platform: "bethq",
        registered,
      },
    ];
  }
  // HTML table without pipes
  const html = text.match(
    /Today's Tip[\s\S]{0,600}?>\s*([A-Za-z][A-Za-z'0-9 -]{2,30})\s*<[\s\S]{0,200}?(\d{1,2}:\d{2})[\s\S]{0,200}?>\s*([A-Za-z][A-Za-z' -]+)\s*</i
  );
  if (html) {
    return [
      {
        horse: html[1].trim(),
        tipster: registered.name,
        course: html[3].trim(),
        time: html[2],
        rationale: `${registered.name} nap at ${html[2]} ${html[3]}`,
        sourceUrl,
        platform: "bethq",
        registered,
      },
    ];
  }
  return [];
}

function parseBettingGods(text: string, sourceUrl: string): RawTip[] {
  const tips: RawTip[] = [];
  const reg = lookupRegisteredTipster("Betting Gods");
  // Free tips often list horse + course + time in prose or list items
  const blocks = text.matchAll(
    /(?:^|\n)\s*([A-Z][A-Za-z' -]{2,30})\s+[\-–—@]\s*(\d{1,2}:\d{2})\s+([A-Za-z][A-Za-z' -]+)/gm
  );
  for (const m of blocks) {
    tips.push({
      horse: m[1].trim(),
      tipster: "Betting Gods",
      course: m[3].trim(),
      time: m[2],
      rationale: `Betting Gods verified free tip at ${m[2]} ${m[3]}`,
      sourceUrl,
      platform: "bettinggods",
      registered: reg,
    });
  }
  // Fallback: "nap" / "selection" patterns
  if (!tips.length) {
    const nap = text.match(
      /(?:nap|selection|tip)[:\s]+([A-Z][A-Za-z' -]{2,30})[^.\n]{0,80}?(\d{1,2}:\d{2})[^.\n]{0,40}?([A-Za-z][A-Za-z' -]+)/i
    );
    if (nap) {
      tips.push({
        horse: nap[1].trim(),
        tipster: "Betting Gods",
        course: nap[3].trim(),
        time: nap[2],
        rationale: `Betting Gods daily free selection`,
        sourceUrl,
        platform: "bettinggods",
        registered: reg,
      });
    }
  }
  return tips;
}

// ------------------------------------------------------- match + convert

function findRunner(
  horse: string,
  runnerNames: string[]
): string | null {
  const needle = normalizeHorseName(horse);
  if (needle.length < 4) return null;
  let best: string | null = null;
  for (const name of runnerNames) {
    const n = normalizeHorseName(name);
    if (n === needle || n.includes(needle) || needle.includes(n)) {
      if (!best || n.length > normalizeHorseName(best).length) best = name;
    }
  }
  return best;
}

function rawToPick(raw: RawTip, idx: number, ctx: LeagueFeedContext): TipsterPick | null {
  const runners = ctx.runnerNames ?? [];
  const matched = runners.length ? findRunner(raw.horse, runners) : null;
  const horse = matched ?? raw.horse;

  const reg = raw.registered ?? lookupRegisteredTipster(raw.tipster);
  let confidence = 0.58;
  let trackRecord = "League tipster feed";
  let hot = false;

  if (reg) {
    confidence += tierConfidenceBoost(reg.tier);
    trackRecord = formatTrackRecord(reg);
    hot = tierIsHotEligible(reg.tier, reg.strikeRate);
  }

  if (raw.consensusPct != null && raw.consensusPct >= 75) {
    confidence += 0.08;
    hot = true;
    trackRecord += ` · ${raw.consensusPct}% OLBG consensus`;
  } else if (raw.consensusPct != null && raw.consensusPct >= 60) {
    confidence += 0.04;
    trackRecord += ` · ${raw.consensusPct}% OLBG consensus`;
  }
  if (raw.expertCount != null && raw.expertCount >= 3 && (raw.consensusPct ?? 0) >= 66) {
    confidence += 0.04;
    hot = true;
  }
  if (raw.steamerPct != null && raw.steamerPct >= 40) {
    confidence += 0.06;
    hot = true;
    trackRecord += ` · steamer ${raw.steamerPct}%`;
  }
  if (/nap of the day|tip of the day/i.test(raw.tipster)) {
    confidence += 0.1;
    hot = true;
  }
  if (matched) confidence += 0.08;

  confidence = Math.min(0.96, confidence);

  return {
    id: `league-${raw.platform}-${idx}`,
    tipster: raw.tipster,
    horse,
    raceId: "",
    confidence,
    trackRecord,
    sourceUrl: raw.sourceUrl,
    rationale: raw.rationale,
    hot,
    platform: raw.platform,
    matchedRunner: matched ?? undefined,
  };
}

function dedupePicks(picks: TipsterPick[]): TipsterPick[] {
  const seen = new Map<string, TipsterPick>();
  for (const p of picks) {
    const key = normalizeHorseName(p.matchedRunner ?? p.horse);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, p);
      continue;
    }
    const keep = existing.confidence >= p.confidence ? existing : p;
    keep.confidence = Math.min(0.97, Math.max(existing.confidence, p.confidence) + 0.04);
    keep.hot = existing.hot || p.hot;
    keep.trackRecord = `${keep.trackRecord} · multi-source`;
    seen.set(key, keep);
  }
  return [...seen.values()];
}

// -------------------------------------------------------------- public API

export async function fetchLeagueTipsterPicks(
  ctx: LeagueFeedContext = {}
): Promise<TipsterPick[]> {
  const raw: RawTip[] = [];
  const urls = LEAGUE_FEED_URLS;

  const [olbg, ttlNap, ttlL15, ttlMm, bethqNaps, bettingGods] = await Promise.all([
    loadPage(urls.olbgTips),
    loadPage(urls.ttlNap),
    loadPage(urls.ttlLucky15),
    loadPage(urls.ttlMarketMovers),
    loadPage(urls.bethqNaps),
    loadPage(urls.bettingGodsFree),
  ]);

  if (olbg) {
    raw.push(...parseOlbgHtml(olbg.raw, urls.olbgTips));
    if (!raw.length) raw.push(...parseOlbgTips(olbg.text, urls.olbgTips));
  }
  if (ttlNap) raw.push(...parseTipsterLeagueNap(ttlNap.raw, urls.ttlNap));
  if (ttlL15) raw.push(...parseTipsterLeagueLucky15(ttlL15.raw, urls.ttlLucky15));
  if (ttlMm) raw.push(...parseTipsterLeagueSteamers(ttlMm.text, urls.ttlMarketMovers));
  if (bethqNaps) raw.push(...parseBethqNap(bethqNaps.text, urls.bethqNaps));
  if (bettingGods) raw.push(...parseBettingGods(bettingGods.text, urls.bettingGodsFree));

  // Top betHQ tipster naps (parallel, capped)
  const slugs = bethqFetchSlugs();
  const bethqPages = await Promise.all(
    slugs.map(async (slug) => {
      const page = await loadPage(`https://www.bethq.com/tipsters/${slug}/`);
      const registered =
        REGISTERED_TIPSTERS.find((t) => t.bethqSlug === slug) ?? null;
      return { page, slug, registered };
    })
  );
  for (const { page, slug, registered } of bethqPages) {
    if (!page || !registered) continue;
    raw.push(
      ...parseBethqTipsterPage(
        page.text,
        `https://www.bethq.com/tipsters/${slug}/`,
        registered
      )
    );
  }

  const picks = dedupePicks(
    raw
      .map((r, i) => rawToPick(r, i, ctx))
      .filter((p): p is TipsterPick => p != null)
  )
    .sort(
      (a, b) =>
        Number(b.hot ?? false) - Number(a.hot ?? false) ||
        b.confidence - a.confidence
    )
    .slice(0, 48);

  const matched = picks.filter((p) => p.matchedRunner).length;
  const hot = picks.filter((p) => p.hot).length;
  console.log(
    `  league feeds: ${picks.length} tips (${matched} matched, ${hot} red-hot) from TTL/OLBG/betHQ/BettingGods`
  );

  return picks;
}

// Re-export for tipster-priority
export { lookupRegisteredTipster } from "./tipster-registry";
