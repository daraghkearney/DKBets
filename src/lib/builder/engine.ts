import { loadFixtures, loadMatchDetail } from "@/lib/stats/engine";
import { fetchBet365LiveOdds } from "./bet365";
import { ODDS_TARGETS } from "./compose";
import { dedupeLegs, legsFromMatchDetail } from "./legs";
import type { BuilderPayload } from "./types";

export async function loadBuilderPayload(): Promise<BuilderPayload> {
  const fixtures = await loadFixtures();
  const apiConfigured = Boolean(process.env.ODDS_API_IO_KEY);
  const liveOdds = await fetchBet365LiveOdds(
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
