import { loadFixtures, loadMatchDetail } from "@/lib/stats/engine";
import {
  BET365_CACHE_VERSION,
  loadCachedBet365EventUrls,
  loadCachedBet365Odds,
  saveCachedBet365Odds,
  shouldRefreshBet365Odds,
} from "./bet365-cache";
import { fetchBet365LiveOdds } from "./bet365";
import type { Bet365LiveBundle, Bet365LiveMap, Bet365LiveQuote } from "./bet365-live";
import { ODDS_TARGETS } from "./compose";
import { dedupeLegs, legsFromMatchDetail } from "./legs";
import type { BuilderPayload } from "./types";

const DEPLOYED_PRICES_URL =
  process.env.BET365_PRICES_URL ??
  "https://daraghkearney.github.io/DKBets/data/bet365-prices.json";

function normalizeQuote(raw: Bet365LiveQuote | number): Bet365LiveQuote {
  if (typeof raw === "number") return { price: raw };
  return raw;
}

async function loadDeployedBet365Prices(): Promise<Bet365LiveBundle | null> {
  try {
    const res = await fetch(DEPLOYED_PRICES_URL, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      version?: number;
      prices?: [string, Bet365LiveQuote | number][];
      eventUrls?: [string, string][];
    };
    if (data.version !== BET365_CACHE_VERSION || !data.prices?.length) return null;
    return {
      quotes: new Map(
        data.prices.map(([key, value]) => [key, normalizeQuote(value)])
      ),
      eventUrls: new Map(
        (data.eventUrls ?? []).map(([id, url]) => [Number(id), url] as [number, string])
      ),
    };
  } catch {
    return null;
  }
}

async function resolveLiveOdds(
  fixtures: { id: number; home: string; away: string }[]
): Promise<Bet365LiveBundle> {
  const empty: Bet365LiveBundle = { quotes: new Map(), eventUrls: new Map() };
  if (!process.env.ODDS_API_IO_KEY) return empty;

  if (!shouldRefreshBet365Odds()) {
    const cached = await loadCachedBet365Odds();
    if (cached?.size) {
      const eventUrls = await loadCachedBet365EventUrls();
      console.log(
        `  bet365 live: using cached prices (${cached.size}) — skipped API to save quota`
      );
      return { quotes: cached, eventUrls };
    }

    const relaxed = await loadCachedBet365Odds({ ignoreAge: true });
    if (relaxed?.size) {
      const eventUrls = await loadCachedBet365EventUrls();
      console.warn(
        `  bet365 live: using expired cache (${relaxed.size}) on push — skipped API`
      );
      return { quotes: relaxed, eventUrls };
    }

    console.warn("  bet365 live: no cache on push — fetching from API");
  }

  const liveOdds = await fetchBet365LiveOdds(fixtures);
  if (liveOdds.quotes.size > 0) {
    await saveCachedBet365Odds(liveOdds.quotes, liveOdds.eventUrls);
    return liveOdds;
  }

  const fallback = await loadCachedBet365Odds({ ignoreAge: true });
  if (fallback?.size) {
    const eventUrls = await loadCachedBet365EventUrls();
    console.warn(
      `  bet365 live: API returned nothing — using last good cache (${fallback.size} prices)`
    );
    return { quotes: fallback, eventUrls };
  }

  const deployed = await loadDeployedBet365Prices();
  if (deployed?.quotes.size) {
    console.warn(
      `  bet365 live: loaded ${deployed.quotes.size} prices from last deployed site snapshot`
    );
    return deployed;
  }

  console.warn("  bet365 live: no prices available (API empty and no cache)");
  return liveOdds;
}

export async function loadBuilderPayload(): Promise<BuilderPayload> {
  const fixtures = await loadFixtures();
  const apiConfigured = Boolean(process.env.ODDS_API_IO_KEY);
  const liveBundle = await resolveLiveOdds(
    fixtures.map((f) => ({ id: f.id, home: f.home, away: f.away }))
  );

  if (apiConfigured) {
    console.log(`  bet365 live price map size: ${liveBundle.quotes.size}`);
  }

  const allLegs: import("./types").BuilderLeg[] = [];

  if (apiConfigured && liveBundle.quotes.size > 0) {
    for (const fx of fixtures) {
      const detail = await loadMatchDetail(fx.id);
      if (detail) {
        allLegs.push(
          ...legsFromMatchDetail(detail, liveBundle.quotes, liveBundle.eventUrls)
        );
      }
    }
  }

  const pool = dedupeLegs(allLegs);
  console.log(
    `  bet365 builder legs built: ${pool.length} (from ${liveBundle.quotes.size} prices)`
  );

  return {
    legs: pool,
    fixtures: fixtures.map((f) => ({
      id: f.id,
      home: f.home,
      away: f.away,
      kickoff: f.kickoff,
    })),
    targets: [...ODDS_TARGETS],
    bet365LiveLegs: pool.length,
    bet365LiveAvailable: pool.length > 0,
    bet365ApiConfigured: apiConfigured,
    bet365PriceCount: liveBundle.quotes.size,
    generatedAt: new Date().toISOString(),
  };
}
