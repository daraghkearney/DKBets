/**
 * Curated high-strike-rate tipsters from league tables at:
 * - The Tipster League (https://www.thetipsterleague.com/best-horse-racing-tipsters)
 * - OLBG (https://www.olbg.com/best-tipsters/Horse_Racing/2)
 * - betHQ (https://www.bethq.com/tipsters/)
 * - Betting Gods (https://bettinggods.com/todays-free-horse-racing-tips/)
 *
 * Strike rates / ROI are from published 6–12 month league tables (Jul 2026).
 * Used to weight model signals and flag red-hot tips.
 */
export type TipsterSource =
  | "tipster-league"
  | "olbg"
  | "bethq"
  | "bettinggods";

export type TipsterTier = "elite" | "strong" | "proven";

export interface RegisteredTipster {
  id: string;
  name: string;
  aliases?: string[];
  source: TipsterSource;
  /** Win strike rate % where published */
  strikeRate?: number;
  /** Return on investment % where published */
  roi?: number;
  /** Level-stakes or points profit where published */
  profit?: number;
  tier: TipsterTier;
  profileUrl?: string;
  /** betHQ tipster page slug for today's nap fetch */
  bethqSlug?: string;
  /** Tipster League profile path slug */
  ttlSlug?: string;
}

/** Aggregate feed pages we scrape each export. */
export const LEAGUE_FEED_URLS = {
  olbgTips: "https://www.olbg.com/betting-tips/Horse_Racing/2",
  olbgBest: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  ttlNap: "https://www.thetipsterleague.com/nap-of-the-day",
  ttlLucky15: "https://www.thetipsterleague.com/lucky-15-tips",
  ttlMarketMovers: "https://www.thetipsterleague.com/market-movers",
  ttlRankings: "https://www.thetipsterleague.com/best-horse-racing-tipsters",
  bethqNaps: "https://www.bethq.com/horse-racing/uk/naps/",
  bethqRankings: "https://www.bethq.com/tipsters/",
  bettingGodsFree: "https://bettinggods.com/todays-free-horse-racing-tips/",
} as const;

export const REGISTERED_TIPSTERS: RegisteredTipster[] = [
  // —— The Tipster League (365-day ROI leaders) ——
  {
    id: "chicken-farmer",
    name: "Chicken Farmer Tips",
    source: "tipster-league",
    roi: 35.53,
    profit: 316.36,
    tier: "elite",
    ttlSlug: "chicken-farmer-tips",
    profileUrl: "https://www.thetipsterleague.com/chicken-farmer-tips",
  },
  {
    id: "rgm-tips",
    name: "RGM Tips",
    source: "tipster-league",
    roi: 28.55,
    profit: 296.99,
    tier: "elite",
    ttlSlug: "rgm-tips",
    profileUrl: "https://www.thetipsterleague.com/rgm-tips",
  },
  {
    id: "racing-tictac",
    name: "Racing Tictac",
    source: "tipster-league",
    roi: 28.18,
    profit: 259.52,
    tier: "elite",
    ttlSlug: "racing-tictac",
    profileUrl: "https://www.thetipsterleague.com/racing-tictac",
  },
  {
    id: "garytips",
    name: "Garytips",
    source: "tipster-league",
    roi: 21.95,
    profit: 233.7,
    tier: "strong",
    ttlSlug: "garytips",
    profileUrl: "https://www.thetipsterleague.com/garytips",
  },
  {
    id: "its-the-napster",
    name: "It's The Napster",
    source: "tipster-league",
    roi: 19.33,
    profit: 200.67,
    tier: "strong",
    ttlSlug: "its-the-napster",
    profileUrl: "https://www.thetipsterleague.com/its-the-napster",
  },
  {
    id: "flat-fever",
    name: "Flat Fever",
    source: "tipster-league",
    roi: 27.04,
    profit: 181.43,
    tier: "elite",
    ttlSlug: "flat-fever",
    profileUrl: "https://www.thetipsterleague.com/flat-fever",
  },
  {
    id: "what-a-race",
    name: "What a Race Tips",
    source: "tipster-league",
    roi: 16.73,
    profit: 139.44,
    tier: "strong",
    ttlSlug: "what-a-race-tips",
    profileUrl: "https://www.thetipsterleague.com/what-a-race-tips",
  },
  {
    id: "the-outside-nap",
    name: "The Outside Nap",
    source: "tipster-league",
    roi: 22.13,
    profit: 79.78,
    tier: "strong",
    ttlSlug: "the-outside-nap",
    profileUrl: "https://www.thetipsterleague.com/the-outside-nap",
  },
  {
    id: "redderz",
    name: "Redderz Tips",
    source: "tipster-league",
    roi: 8.63,
    profit: 75.64,
    tier: "proven",
    ttlSlug: "redderz-tips",
    profileUrl: "https://www.thetipsterleague.com/redderz-tips",
  },
  {
    id: "horseplays",
    name: "Horseplays",
    source: "tipster-league",
    roi: 3.63,
    profit: 36.44,
    tier: "proven",
    ttlSlug: "horseplays",
    profileUrl: "https://www.thetipsterleague.com/horseplays",
  },

  // —— OLBG (active tipsters with highest strike rates) ——
  {
    id: "knottlast",
    name: "Knottlast",
    source: "olbg",
    strikeRate: 37,
    profit: 1995,
    tier: "elite",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "hawkeye",
    name: "Hawkeye",
    source: "olbg",
    strikeRate: 37,
    profit: 1624,
    tier: "elite",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "goaty-mc-boaty",
    name: "GoatyMcBoaty",
    source: "olbg",
    strikeRate: 39,
    profit: 405,
    tier: "elite",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "edwinp",
    name: "Edwinp",
    source: "olbg",
    strikeRate: 36,
    profit: 571,
    tier: "elite",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "desijo",
    name: "Desijo",
    source: "olbg",
    strikeRate: 27,
    profit: 216,
    tier: "strong",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "karl-pro68",
    name: "Karl_Pro68",
    aliases: ["Karl Pro68"],
    source: "olbg",
    strikeRate: 29,
    profit: 121,
    tier: "strong",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "the-prophet",
    name: "the prophet",
    source: "olbg",
    strikeRate: 25,
    profit: 331,
    tier: "strong",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "welshboy",
    name: "Welshboy",
    source: "olbg",
    strikeRate: 29,
    profit: 258,
    tier: "strong",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "deano123",
    name: "Deano123",
    source: "olbg",
    strikeRate: 35,
    profit: 238,
    tier: "elite",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "david-xristo",
    name: "David Xristo",
    source: "olbg",
    strikeRate: 27,
    profit: 457,
    tier: "strong",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },
  {
    id: "niffler",
    name: "Niffler",
    source: "olbg",
    profit: 4354,
    tier: "elite",
    profileUrl: "https://www.olbg.com/best-tipsters/Horse_Racing/2",
  },

  // —— betHQ (win-bet strike rate leaders) ——
  {
    id: "bettinggods-bethq",
    name: "Betting Gods",
    aliases: ["bettinggods.com"],
    source: "bettinggods",
    strikeRate: 54.35,
    roi: 30.15,
    tier: "elite",
    bethqSlug: "bettinggods-com",
    profileUrl: "https://bettinggods.com/todays-free-horse-racing-tips/",
  },
  {
    id: "newmarket-rp",
    name: "Newmarket",
    aliases: ["Newmarket (Racing Post)", "Racing Post Newmarket"],
    source: "bethq",
    strikeRate: 50.7,
    roi: 52.11,
    profit: 37,
    tier: "elite",
    bethqSlug: "newmarket",
    profileUrl: "https://www.bethq.com/tipsters/newmarket/",
  },
  {
    id: "the-brigadier",
    name: "The Brigadier",
    aliases: ["The Brigadier (punterslounge.com)"],
    source: "bethq",
    strikeRate: 41.77,
    roi: 22.96,
    profit: 36.28,
    tier: "elite",
    bethqSlug: "the-brigadier",
    profileUrl: "https://www.bethq.com/tipsters/the-brigadier/",
  },
  {
    id: "jeffrey-ross",
    name: "Jeffrey Ross",
    aliases: ["Jeffrey Ross (Sporting Times)"],
    source: "bethq",
    strikeRate: 30.57,
    profit: 25.64,
    tier: "strong",
    bethqSlug: "jeffrey-ross",
    profileUrl: "https://www.bethq.com/tipsters/jeffrey-ross/",
  },
  {
    id: "adrian-wall",
    name: "Adrian Wall",
    aliases: ["Adrian Wall (myracing.com)"],
    source: "bethq",
    strikeRate: 12.1,
    profit: 28.08,
    tier: "proven",
    bethqSlug: "adrian-wall",
    profileUrl: "https://www.bethq.com/tipsters/adrian-wall/",
  },
  {
    id: "ratings-hub",
    name: "Ratings Hub",
    aliases: ["Ratings Hub (attheraces.com)"],
    source: "bethq",
    strikeRate: 33.12,
    tier: "elite",
    bethqSlug: "ratings-hub",
    profileUrl: "https://www.bethq.com/tipsters/ratings-hub/",
  },
];

const byName = new Map<string, RegisteredTipster>();

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

for (const t of REGISTERED_TIPSTERS) {
  byName.set(norm(t.name), t);
  for (const a of t.aliases ?? []) byName.set(norm(a), t);
}

/** Look up a registered tipster by display name or alias. */
export function lookupRegisteredTipster(name: string): RegisteredTipster | null {
  const key = norm(name);
  if (byName.has(key)) return byName.get(key)!;
  for (const [k, t] of byName) {
    if (key.includes(k) || k.includes(key)) return t;
  }
  return null;
}

/** betHQ slugs for today's nap pages — top strike-rate tipsters only. */
export function bethqFetchSlugs(): string[] {
  return REGISTERED_TIPSTERS.filter((t) => t.bethqSlug && t.tier !== "proven")
    .map((t) => t.bethqSlug!)
    .slice(0, 8);
}

export function tierConfidenceBoost(tier: TipsterTier): number {
  if (tier === "elite") return 0.15;
  if (tier === "strong") return 0.1;
  return 0.05;
}

export function tierIsHotEligible(tier: TipsterTier, strikeRate?: number): boolean {
  if (tier === "elite") return true;
  if (tier === "strong" && (strikeRate ?? 0) >= 28) return true;
  return (strikeRate ?? 0) >= 35;
}

export function formatTrackRecord(t: RegisteredTipster): string {
  const parts: string[] = [];
  if (t.strikeRate != null) parts.push(`${t.strikeRate}% strike rate`);
  if (t.roi != null) parts.push(`${t.roi}% ROI`);
  if (t.profit != null && t.source === "olbg") {
    parts.push(`+${t.profit} pts profit (OLBG)`);
  } else if (t.profit != null) {
    parts.push(`+${t.profit} LSP`);
  }
  parts.push(`${t.tier} · ${t.source}`);
  return parts.join(" · ");
}
