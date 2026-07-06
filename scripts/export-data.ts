/**
 * Pre-fetch live data into public/data/ for static GitHub Pages deploys.
 * Run before `next build` when output: 'export'.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { buildLiveSnapshot } from "../src/lib/data/live";
import { buildSimulatedSnapshot } from "../src/lib/data/simulator";
import {
  loadBankerPicks,
  loadFixtures,
  loadMatchDetail,
  loadPlayerLeaderboard,
  loadUpcomingWithProps,
} from "../src/lib/stats/engine";
import { loadBuilderPayload } from "../src/lib/builder/engine";
import { precomputeBuilderViews } from "../src/lib/builder/compose";

const ROOT = path.join(process.cwd(), "public", "data");

async function writeJson(rel: string, data: unknown) {
  const file = path.join(ROOT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data), "utf8");
  console.log("  wrote", rel);
}

async function main() {
  console.log("Exporting live data to public/data/ …");
  await mkdir(ROOT, { recursive: true });

  let odds;
  try {
    odds = await buildLiveSnapshot();
  } catch (e) {
    console.warn("  odds: live fetch failed, using simulator", e);
    odds = buildSimulatedSnapshot();
  }
  await writeJson("odds.json", {
    ...odds,
    exportedAt: new Date().toISOString(),
  });

  console.log("  stats: building player index (may take 1–2 min) …");
  const players = await loadPlayerLeaderboard();
  await writeJson("stats/players.json", {
    ...players,
    source: "fotmob",
    sourceLabel: "Live via fotmob.com",
    exportedAt: new Date().toISOString(),
  });

  const fixtures = await loadUpcomingWithProps();
  await writeJson("stats/matches.json", {
    fixtures,
    exportedAt: new Date().toISOString(),
  });

  const bankers = await loadBankerPicks();
  await writeJson("stats/bankers.json", {
    bankers,
    exportedAt: new Date().toISOString(),
  });

  const upcoming = await loadFixtures();
  const ids = upcoming.map((f) => f.id);
  await writeJson("stats/fixture-ids.json", { ids });

  for (const id of ids) {
    try {
      const detail = await loadMatchDetail(id);
      if (detail) {
        await writeJson(`stats/match/${id}.json`, {
          ...detail,
          source: "fotmob",
          sourceLabel: "Live via fotmob.com",
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn(`  skip match ${id}:`, e);
    }
  }

  console.log("  builder: composing bet builders …");
  const builder = await loadBuilderPayload();
  builder.precomputed = precomputeBuilderViews(
    builder.legs,
    builder.fixtures,
    Array.from({ length: 15 }, (_, i) => i + 1)
  );
  await writeJson("builder.json", builder);

  try {
    const cacheFile = path.join(process.cwd(), ".cache", "bet365-live-odds.json");
    const raw = await readFile(cacheFile, "utf8");
    await writeJson("bet365-prices.json", JSON.parse(raw));
  } catch {
    /* no price cache this run */
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
