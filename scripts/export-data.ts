/**
 * Pre-fetch live data into public/data/ for static GitHub Pages deploys.
 * Run before `next build` when output: 'export'.
 */
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  loadBankerPicks,
  loadFixtures,
  loadMatchDetail,
  loadPlayerLeaderboard,
  loadUpcomingWithProps,
} from "../src/lib/stats/engine";
import { loadBuilderPayload } from "../src/lib/builder/engine";
import { precomputeBuilderViews } from "../src/lib/builder/compose";
import { precomputeContextBuilderViews } from "../src/lib/builder/context-compose";
import { buildStarPlayersPayload } from "../src/lib/builder/star-player";
import { buildTeamModelPayload } from "../src/lib/builder/team-model";
import {
  clearPlayerIndexCache,
  ensurePlayerIndex,
  getTeamHistory,
  setActiveSampleMode,
} from "../src/lib/stats/store";
import { clearFotmobCache } from "../src/lib/stats/fotmob";
import {
  DEFAULT_SAMPLE_MODE,
  SAMPLE_MODES,
  sampleModeLabel,
  type StatsSampleMode,
} from "../src/lib/stats/sample-mode";
import { buildHorseRacingPayload } from "../src/lib/horse-racing/engine";
import { buildRacingCalendarPayload } from "../src/lib/horse-racing/calendar";
import { buildNbaPayload } from "../src/lib/nba/client";
import { SPORTS } from "../src/lib/sports/config";
import {
  loadCachedBet365EventUrls,
  loadCachedBet365Odds,
} from "../src/lib/builder/bet365-cache";

const ROOT = path.join(process.cwd(), "public", "data");

async function writeJson(rel: string, data: unknown) {
  const file = path.join(ROOT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data), "utf8");
  console.log("  wrote", rel);
}

async function exportSampleMode(mode: StatsSampleMode) {
  console.log(`\n  [${mode}] exporting sample dataset …`);
  clearFotmobCache();
  clearPlayerIndexCache();
  setActiveSampleMode(mode);
  const prefix = `samples/${mode}`;
  const sampleMeta = {
    sampleMode: mode,
    sampleLabel: sampleModeLabel(mode),
    source: "fotmob",
    sourceLabel: `FotMob · ${sampleModeLabel(mode)}`,
    exportedAt: new Date().toISOString(),
  };

  const players = await loadPlayerLeaderboard();
  await writeJson(`${prefix}/stats/players.json`, { ...players, ...sampleMeta });

  const fixtures = await loadUpcomingWithProps();
  await writeJson(`${prefix}/stats/matches.json`, {
    fixtures,
    ...sampleMeta,
  });

  const bankers = await loadBankerPicks();
  await writeJson(`${prefix}/stats/bankers.json`, { bankers, ...sampleMeta });

  const upcoming = await loadFixtures();
  const ids = upcoming.map((f) => f.id);
  await writeJson(`${prefix}/stats/fixture-ids.json`, { ids, ...sampleMeta });

  for (const id of ids) {
    try {
      const detail = await loadMatchDetail(id);
      if (detail) {
        await writeJson(`${prefix}/stats/match/${id}.json`, {
          ...detail,
          ...sampleMeta,
        });
      }
    } catch (e) {
      console.warn(`  skip match ${id} (${mode}):`, e);
    }
  }

  console.log(`  [${mode}] builder …`);
  const builder = await loadBuilderPayload();
  builder.precomputed = precomputeBuilderViews(
    builder.legs,
    builder.fixtures,
    Array.from({ length: 15 }, (_, i) => i + 1)
  );
  builder.contextPrecomputed = precomputeContextBuilderViews(
    builder.legs,
    builder.fixtures,
    Array.from({ length: 15 }, (_, i) => i + 1)
  );
  await writeJson(`${prefix}/builder.json`, { ...builder, ...sampleMeta });

  const liveOdds = await loadCachedBet365Odds({ ignoreAge: true });
  const eventUrls = await loadCachedBet365EventUrls();
  const playerIndex = await ensurePlayerIndex(mode);

  console.log(`  [${mode}] star players …`);
  const starPlayers = await buildStarPlayersPayload(
    builder.legs,
    upcoming,
    loadMatchDetail,
    liveOdds ?? undefined,
    eventUrls.size ? eventUrls : undefined,
    playerIndex
  );
  await writeJson(`${prefix}/star-players.json`, {
    ...starPlayers,
    ...sampleMeta,
  });

  console.log(`  [${mode}] team model …`);
  const teamHistory = getTeamHistory(mode);
  const teamModel = buildTeamModelPayload(
    teamHistory,
    playerIndex ? [...playerIndex.values()] : [],
    upcoming,
    liveOdds ?? undefined,
    eventUrls.size ? eventUrls : undefined
  );
  await writeJson(`${prefix}/team-model.json`, { ...teamModel, ...sampleMeta });

  if (mode === DEFAULT_SAMPLE_MODE) {
    await writeJson("stats/players.json", { ...players, ...sampleMeta });
    await writeJson("stats/matches.json", { fixtures, ...sampleMeta });
    await writeJson("stats/bankers.json", { bankers, ...sampleMeta });
    await writeJson("stats/fixture-ids.json", { ids, ...sampleMeta });
    await writeJson("builder.json", { ...builder, ...sampleMeta });
    await writeJson("star-players.json", { ...starPlayers, ...sampleMeta });
    await writeJson("team-model.json", { ...teamModel, ...sampleMeta });
    for (const id of ids) {
      try {
        const detail = await loadMatchDetail(id);
        if (detail) {
          await writeJson(`stats/match/${id}.json`, { ...detail, ...sampleMeta });
        }
      } catch {
        /* already logged */
      }
    }
  }
  clearFotmobCache();
  clearPlayerIndexCache();
}

async function main() {
  console.log("Exporting live data to public/data/ …");
  await mkdir(ROOT, { recursive: true });

  await writeJson("sample-manifest.json", {
    defaultMode: DEFAULT_SAMPLE_MODE,
    modes: SAMPLE_MODES,
    exportedAt: new Date().toISOString(),
  });

  for (const mode of SAMPLE_MODES) {
    await exportSampleMode(mode.id);
  }

  try {
    const cacheFile = path.join(process.cwd(), ".cache", "bet365-live-odds.json");
    const raw = await readFile(cacheFile, "utf8");
    await writeJson("bet365-prices.json", JSON.parse(raw));
  } catch {
    /* no price cache this run */
  }

  await writeJson("sports-manifest.json", {
    sports: SPORTS.map((s) => ({
      id: s.id,
      label: s.label,
      competitions: s.competitions.map((c) => ({
        id: c.id,
        label: c.label,
        live: c.live,
      })),
    })),
    exportedAt: new Date().toISOString(),
  });

  console.log("\n  [nba] exporting NBA.com stats …");
  try {
    const nba = await buildNbaPayload();
    await writeJson("nba/nba/hub.json", nba);
    console.log(`  nba: ${nba.leaders.length} leaders, ${nba.scoreboard.length} games, ${nba.playerProps.length} prop profiles`);
  } catch (e) {
    console.warn("  nba: export failed", e);
  }

  const racingMeetings = ["todays-races", "cheltenham", "punchestown"] as const;

  console.log("\n  [horse-racing] exporting week calendar …");
  try {
    const calendar = await buildRacingCalendarPayload();
    await writeJson("horse-racing/todays-races/calendar.json", calendar);
    const dayCount = calendar.days.filter((d) => d.meetings.length).length;
    console.log(
      `  racing calendar: ${dayCount} days with meetings, ${calendar.tipsters.length} tipsters`
    );
  } catch (e) {
    console.warn("  racing calendar: export failed", e);
  }

  for (const meeting of racingMeetings) {
    console.log(`\n  [horse-racing/${meeting}] exporting …`);
    try {
      const payload = await buildHorseRacingPayload(meeting);
      await writeJson(`horse-racing/${meeting}/hub.json`, payload);
      console.log(
        `  racing: ${payload.races.length} races, ${payload.tipsters.length} tipsters`
      );
    } catch (e) {
      console.warn(`  racing/${meeting}: export failed`, e);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
