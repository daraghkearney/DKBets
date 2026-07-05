import { loadFixtures, loadMatchDetail } from "@/lib/stats/engine";
import {
  loadCachedBet365Odds,
  saveCachedBet365Odds,
  shouldRefreshBet365Odds,
} from "./bet365-cache";
import { fetchBet365LiveOdds } from "./bet365";
import { ODDS_TARGETS } from "./compose";
import { dedupeLegs, legsFromMatchDetail } from "./legs";
import type { BuilderPayload } from "./types";

async function resolveLiveOdds(
  fixtures: { id: number; home: string; away: string }[]
): Promise<Map<string, number>> {
  if (!process.env.ODDS_API_IO_KEY) return new Map();

  if (!shouldRefreshBet365Odds()) {
    const cached = await loadCachedBet365Odds();
    if (cached?.size) {
      console.log(
        `  bet365 live: using cached prices (${cached.size}) — skipped API to save quota`
      );
      return cached;
    }
    console.warn("  bet365 live: push deploy with no cache — waiting for scheduled refresh");
    return new Map();
  }

  const liveOdds = await fetchBet365LiveOdds(fixtures);
  if (liveOdds.size > 0) {
    await saveCachedBet365Odds(liveOdds);
    return liveOdds;
  }

  const stale = await loadCachedBet365Odds(true);
  if (stale?.size) {
    console.warn(`  bet365 live: no fresh prices — using stale cache (${stale.size})`);
    return stale;
  }

  return liveOdds;
}

export async function loadBuilderPayload(): Promise<BuilderPayload> {
  const fixtures = await loadFixtures();
  const apiConfigured = Boolean(process.env.ODDS_API_IO_KEY);
  const liveOdds = await resolveLiveOdds(
    fixtures.map((f) => ({ id: f.id, home: f.home, away: f.away }))
  );

  if (apiConfigured) {
    console.log(`  bet365 live prices fetched: ${liveOdds.size}`);
  }

  const allLegs: import("./types").BuilderLeg[] = [];

  if (apiConfigured && liveOdds.size > 0) {
    for (const fx of fixtures) {
      const detail = await loadMatchDetail(fx.id);
      if (detail) allLegs.push(...legsFromMatchDetail(detail, liveOdds));
    }
  }

  const pool = dedupeLegs(allLegs);

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
    generatedAt: new Date().toISOString(),
  };
}
