import { BOOKMAKER_IDS } from "../bookmakers";
import type {
  BookmakerId,
  Market,
  MarketType,
  Match,
  OddsSnapshot,
  OutcomeOdds,
} from "../types";

/**
 * Deterministic live-odds engine.
 *
 * Everything is a pure function of (ids, wall-clock time bucket), so the
 * server stays stateless while odds still drift realistically between
 * polls: each bookmaker/outcome cell re-prices on its own schedule, and a
 * subset of "hot" markets each day carries genuine cross-bookmaker
 * disagreement, which is what produces arbitrage windows.
 */

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rand(key: string): number {
  return mulberry32(hash(key))();
}

// ---------------------------------------------------------------------------
// Teams, venues, schedule
// ---------------------------------------------------------------------------

const TEAMS: Array<[string, string]> = [
  ["Argentina", "🇦🇷"], ["France", "🇫🇷"], ["England", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"], ["Brazil", "🇧🇷"],
  ["Spain", "🇪🇸"], ["Portugal", "🇵🇹"], ["Netherlands", "🇳🇱"], ["Germany", "🇩🇪"],
  ["Italy", "🇮🇹"], ["Belgium", "🇧🇪"], ["Croatia", "🇭🇷"], ["Uruguay", "🇺🇾"],
  ["Colombia", "🇨🇴"], ["Morocco", "🇲🇦"], ["USA", "🇺🇸"], ["Mexico", "🇲🇽"],
  ["Japan", "🇯🇵"], ["Senegal", "🇸🇳"], ["Switzerland", "🇨🇭"], ["Denmark", "🇩🇰"],
  ["Ecuador", "🇪🇨"], ["South Korea", "🇰🇷"], ["Australia", "🇦🇺"], ["Nigeria", "🇳🇬"],
];

const VENUES = [
  "MetLife Stadium, New York",
  "SoFi Stadium, Los Angeles",
  "AT&T Stadium, Dallas",
  "Estadio Azteca, Mexico City",
  "Hard Rock Stadium, Miami",
  "Mercedes-Benz Stadium, Atlanta",
  "BC Place, Vancouver",
  "NRG Stadium, Houston",
];

const KICKOFF_HOURS = [17, 20, 23];

function stageFor(date: Date): string {
  if (date.getFullYear() !== 2026 || date.getMonth() < 5)
    return "World Cup 2026";
  const m = date.getMonth();
  const d = date.getDate();
  if (m === 5) return d < 28 ? "Group Stage" : "Round of 32";
  if (m === 6) {
    if (d <= 3) return "Round of 32";
    if (d <= 7) return "Round of 16";
    if (d <= 11) return "Quarter-Final";
    if (d <= 16) return "Semi-Final";
    if (d <= 18) return "Third-Place Play-off";
    return "Final";
  }
  return "World Cup 2026";
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

interface Fixture {
  id: string;
  kickoff: Date;
  stage: string;
  venue: string;
  home: [string, string];
  away: [string, string];
}

/** Deterministic fixtures for a given calendar day (3 per day). */
function fixturesForDay(dayStart: Date): Fixture[] {
  const key = dateKey(dayStart);
  const rng = mulberry32(hash(`fixtures:${key}`));
  const pool = [...TEAMS];
  // Fisher-Yates shuffle seeded by the date
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const stage = stageFor(dayStart);
  const fixtures: Fixture[] = [];
  for (let i = 0; i < 3; i++) {
    const home = pool[i * 2];
    const away = pool[i * 2 + 1];
    const kickoff = new Date(dayStart);
    kickoff.setHours(KICKOFF_HOURS[i], 0, 0, 0);
    fixtures.push({
      id: `wc-${key}-${i}`,
      kickoff,
      stage,
      venue: VENUES[Math.floor(rng() * VENUES.length)],
      home,
      away,
    });
  }
  return fixtures;
}

// ---------------------------------------------------------------------------
// Odds generation
// ---------------------------------------------------------------------------

/** Snap a decimal price to a realistic bookmaker ladder increment. */
function snapOdds(x: number): number {
  let step: number;
  if (x < 2) step = 0.01;
  else if (x < 3) step = 0.02;
  else if (x < 4) step = 0.05;
  else step = 0.1;
  return Math.max(1.01, Math.round(Math.round(x / step) * step * 100) / 100);
}

/**
 * Per-cell drift multiplier. Each (market, outcome, bookmaker) cell
 * re-prices on its own period (25–80s) so only some odds move at a time.
 */
function drift(cellKey: string, now: number): number {
  const period = 25_000 + Math.floor(rand(`period:${cellKey}`) * 55_000);
  const bucket = Math.floor(now / period);
  const r = rand(`drift:${cellKey}:${bucket}`);
  return 0.965 + r * 0.07; // ±3.5%
}

interface MarketSpec {
  type: MarketType;
  name: string;
  outcomes: Array<{ key: string; label: string; prob: number }>;
}

function marketSpecs(fx: Fixture): MarketSpec[] {
  const r = mulberry32(hash(`probs:${fx.id}`));
  let pHome = 0.28 + r() * 0.34;
  let pDraw = 0.2 + r() * 0.1;
  let pAway = Math.max(0.08, 1 - pHome - pDraw);
  const total = pHome + pDraw + pAway;
  pHome /= total;
  pDraw /= total;
  pAway /= total;

  const pBtts = 0.44 + r() * 0.18;
  const pOver = 0.44 + r() * 0.16;
  const pQualifyHome = Math.min(0.85, pHome + pDraw * 0.5);

  return [
    {
      type: "match_result",
      name: "Match Result (90 mins)",
      outcomes: [
        { key: "home", label: fx.home[0], prob: pHome },
        { key: "draw", label: "Draw", prob: pDraw },
        { key: "away", label: fx.away[0], prob: pAway },
      ],
    },
    {
      type: "to_qualify",
      name: "To Qualify / Lift Trophy",
      outcomes: [
        { key: "home", label: fx.home[0], prob: pQualifyHome },
        { key: "away", label: fx.away[0], prob: 1 - pQualifyHome },
      ],
    },
    {
      type: "btts",
      name: "Both Teams To Score",
      outcomes: [
        { key: "yes", label: "Yes", prob: pBtts },
        { key: "no", label: "No", prob: 1 - pBtts },
      ],
    },
    {
      type: "over_under_2_5",
      name: "Over / Under 2.5 Goals",
      outcomes: [
        { key: "over", label: "Over 2.5", prob: pOver },
        { key: "under", label: "Under 2.5", prob: 1 - pOver },
      ],
    },
  ];
}

/**
 * "Hot" markets carry deliberate cross-bookmaker disagreement — two
 * bookmakers each go long on opposite outcomes, which is what opens the
 * arbitrage window. The first market of the first match each day is always
 * hot so there is always at least one standout pick per day.
 */
function hotBoost(
  fx: Fixture,
  market: MarketSpec,
  matchIndex: number,
  marketIndex: number,
  outcomeIndex: number,
  bookie: BookmakerId,
  now: number
): number {
  const day = dateKey(fx.kickoff);
  const marketKey = `${fx.id}:${market.type}`;
  const alwaysHot = matchIndex === 0 && marketIndex === 1;
  const isHot = alwaysHot || rand(`hot:${day}:${marketKey}`) < 0.12;
  if (!isHot) return 1;

  const n = market.outcomes.length;
  const bookieCount = BOOKMAKER_IDS.length;
  // Deterministically pair each boosted outcome with a distinct bookmaker
  const firstBookie = Math.floor(rand(`hotb1:${marketKey}`) * bookieCount);
  const secondBookie =
    (firstBookie + 1 + Math.floor(rand(`hotb2:${marketKey}`) * (bookieCount - 1))) %
    bookieCount;
  const firstOutcome = Math.floor(rand(`hoto:${marketKey}`) * n);
  const secondOutcome = n === 2 ? 1 - firstOutcome : (firstOutcome + 1 + Math.floor(rand(`hoto2:${marketKey}`) * (n - 1))) % n;

  const bookieIdx = BOOKMAKER_IDS.indexOf(bookie);
  const boosted =
    (outcomeIndex === firstOutcome && bookieIdx === firstBookie) ||
    (outcomeIndex === secondOutcome && bookieIdx === secondBookie);
  if (!boosted) return 1;

  // Window strength itself breathes over time (2–6 min cycles), so arbs
  // open, tighten and close rather than sitting still.
  const cycle = 120_000 + Math.floor(rand(`hotcycle:${marketKey}`) * 240_000);
  const phase = Math.floor(now / cycle);
  const strength = rand(`hotstr:${marketKey}:${phase}`);
  return 1.03 + strength * 0.05; // +3% to +8%
}

function buildMarket(
  fx: Fixture,
  spec: MarketSpec,
  matchIndex: number,
  marketIndex: number,
  now: number
): Market {
  const overround = 1.035 + rand(`ovr:${fx.id}:${spec.type}`) * 0.035;

  const outcomes: OutcomeOdds[] = spec.outcomes.map((oc, oi) => {
    const fair = 1 / oc.prob;
    const base = fair / overround;
    const odds = {} as Record<BookmakerId, number | null>;
    for (const bookie of BOOKMAKER_IDS) {
      const cellKey = `${fx.id}:${spec.type}:${oc.key}:${bookie}`;
      const spread = 0.97 + rand(`spread:${cellKey}`) * 0.05;
      const boost = hotBoost(fx, spec, matchIndex, marketIndex, oi, bookie, now);
      odds[bookie] = snapOdds(base * spread * drift(cellKey, now) * boost);
    }
    return { key: oc.key, label: oc.label, odds };
  });

  return {
    id: spec.type,
    type: spec.type,
    name: spec.name,
    outcomes,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function buildSimulatedSnapshot(daysAhead = 4): OddsSnapshot {
  const now = Date.now();
  const matches: Match[] = [];

  for (let offset = 0; offset < daysAhead; offset++) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() + offset);

    for (const [mi, fx] of fixturesForDay(dayStart).entries()) {
      // Skip today's matches that have already kicked off
      if (offset === 0 && fx.kickoff.getTime() < now) continue;
      const specs = marketSpecs(fx);
      matches.push({
        id: fx.id,
        kickoff: fx.kickoff.toISOString(),
        stage: fx.stage,
        venue: fx.venue,
        home: fx.home[0],
        away: fx.away[0],
        homeFlag: fx.home[1],
        awayFlag: fx.away[1],
        markets: specs.map((spec, si) => buildMarket(fx, spec, mi, si, now)),
      });
    }
  }

  return {
    generatedAt: new Date(now).toISOString(),
    source: "simulated",
    sourceLabel: "Simulation (all live feeds unavailable)",
    sources: [],
    matches,
  };
}
