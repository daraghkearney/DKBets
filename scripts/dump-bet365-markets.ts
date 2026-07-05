/**
 * Dump Bet365 market names for one fixture (~2 API calls). Use to verify parser mapping.
 * ODDS_API_IO_KEY=… npm run dump:bet365-markets
 */
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const WC_LEAGUE = "international-fifa-world-cup";
const TARGET = { home: "Brazil", away: "Norway" };

async function fetchJson(url: URL) {
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${url.pathname} HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const key = process.env.ODDS_API_IO_KEY;
  if (!key) {
    console.error("ODDS_API_IO_KEY is not set");
    process.exit(1);
  }

  const eventsUrl = new URL("https://api.odds-api.io/v3/events");
  eventsUrl.searchParams.set("apiKey", key);
  eventsUrl.searchParams.set("sport", "football");
  eventsUrl.searchParams.set("league", WC_LEAGUE);
  eventsUrl.searchParams.set("bookmaker", "Bet365");
  eventsUrl.searchParams.set("status", "pending");
  eventsUrl.searchParams.set("limit", "500");

  const events = await fetchJson(eventsUrl);
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const hit = (Array.isArray(events) ? events : []).find((ev) => {
    const h = norm(String(ev.home ?? ""));
    const a = norm(String(ev.away ?? ""));
    return (
      (h.includes("brazil") && a.includes("norway")) ||
      (h.includes("norway") && a.includes("brazil"))
    );
  });

  if (!hit?.id) {
    console.error("Brazil v Norway not found in odds-api.io events");
    process.exit(1);
  }

  console.log(`Event ${hit.id}: ${hit.home} v ${hit.away}`);

  const oddsUrl = new URL("https://api.odds-api.io/v3/odds/multi");
  oddsUrl.searchParams.set("apiKey", key);
  oddsUrl.searchParams.set("eventIds", String(hit.id));
  oddsUrl.searchParams.set("bookmakers", "Bet365");

  const oddsData = await fetchJson(oddsUrl);
  const event = Array.isArray(oddsData) ? oddsData[0] : oddsData;
  const bet365 = event?.bookmakers?.Bet365 ?? event?.bookmakers?.bet365 ?? [];

  const watch = /haaland|gabriel|shot|foul|tackle|target|prop/i;
  const dump: unknown[] = [];

  for (const market of bet365) {
    const marketName = String(market?.name ?? "");
    const rows = market?.odds ?? [];
    const interesting =
      watch.test(marketName) ||
      rows.some((r: { label?: string; name?: string }) =>
        watch.test(`${r?.label ?? ""} ${r?.name ?? ""}`)
      );

    if (!interesting) continue;

    dump.push({
      market: marketName,
      rows: rows.map((r: Record<string, unknown>) => ({
        label: r.label,
        name: r.name,
        hdp: r.hdp ?? r.handicap ?? r.line,
        over: r.over,
        under: r.under,
        yes: r.yes,
        price: r.price ?? r.odds ?? r.decimal,
      })),
    });
  }

  const outDir = path.join(process.cwd(), ".cache");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "bet365-markets-dump.json");
  await writeFile(outFile, JSON.stringify(dump, null, 2), "utf8");

  console.log(`Wrote ${dump.length} markets to ${outFile}`);
  for (const m of dump as { market: string; rows: unknown[] }[]) {
    console.log(`\n[${m.market}] (${m.rows.length} rows)`);
    for (const row of m.rows.slice(0, 8)) {
      console.log(" ", JSON.stringify(row));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
