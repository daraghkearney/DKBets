/**
 * Bulk historical learning — run locally to seed model weights.
 *
 * Usage:
 *   npm run backfill:racing -- --days 90
 *
 * Data sources (in order):
 *   1. The Racing API — 500k+ UK/IRE results (you already subscribe)
 *   2. At The Races scrape fallback
 *   3. HorseRacing.net fallback
 *
 * Free offline alternative: https://github.com/joenano/rpscrape
 * Paid CSV dumps: https://horseracedatabase.com/ (UK since 2011)
 */
import { runFullBackfill } from "../src/lib/horse-racing/historical-backfill";

const days = Number(
  process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ??
    process.argv[process.argv.indexOf("--days") + 1] ??
    30
);

console.log(`\nRacing model backfill — ${days} days of historical results\n`);
(async () => {
  await runFullBackfill(days);
  console.log("\nDone.\n");
})();
