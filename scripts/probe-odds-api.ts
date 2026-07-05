/**
 * Single lightweight call to odds-api.io — checks quota without fetching odds.
 * Usage: ODDS_API_IO_KEY=… npm run probe:odds-api
 */
async function main() {
  const key = process.env.ODDS_API_IO_KEY;
  if (!key) {
    console.error("ODDS_API_IO_KEY is not set");
    process.exit(1);
  }

  const url = new URL("https://api.odds-api.io/v3/events");
  url.searchParams.set("apiKey", key);
  url.searchParams.set("sport", "football");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  const limit = res.headers.get("x-ratelimit-limit");
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");

  console.log(`HTTP ${res.status}`);
  console.log(`x-ratelimit-limit: ${limit ?? "n/a"}`);
  console.log(`x-ratelimit-remaining: ${remaining ?? "n/a"}`);
  console.log(`x-ratelimit-reset: ${reset ?? "n/a"}`);

  if (res.status === 429) {
    console.error("Rate limited — wait until reset before refreshing Bet365 odds.");
    process.exit(1);
  }

  if (!res.ok) {
    console.error("Unexpected response from odds-api.io");
    process.exit(1);
  }

  console.log("Quota OK — safe to refresh Bet365 odds (~2 more API calls).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
