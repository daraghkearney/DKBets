/**
 * One-off: rebuild performance ledger from .cache/racing-predictions + results.
 * Usage: npx tsx --env-file=.env.local scripts/backfill-racing-ledger.ts
 */
import {
  backfillPerformanceLedger,
  enrichLedgerPickOdds,
  loadPerformanceStats,
} from "../src/lib/horse-racing/performance-ledger";

async function main() {
  const maxPerRun = Number(process.env.RACING_LEDGER_BACKFILL_MAX ?? "14");
  const r = await backfillPerformanceLedger({ windowDays: 90, maxPerRun });
  console.log("backfill", r);
  const enrich = await enrichLedgerPickOdds({ maxDates: 14 });
  console.log("enrich", enrich);
  const s = await loadPerformanceStats(90);
  console.log("stats", {
    totalPicks: s.totalPicks,
    wins: s.wins,
    winRate: s.winRate,
    top3: s.top3,
    top3Rate: s.top3Rate,
    roiFlatStake: s.roiFlatStake,
    napPicks: s.napPicks,
    napWins: s.napWins,
    ewGemPicks: s.ewGemPicks,
    ewGemPlaces: s.ewGemPlaces,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
