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
  setActiveFootballCompetition,
  setActiveSampleMode,
} from "../src/lib/stats/store";
import { clearFotmobCache } from "../src/lib/stats/fotmob";
import {
  DEFAULT_SAMPLE_MODE,
  SAMPLE_MODES,
  sampleModeLabel,
  sampleModesForCompetition,
  type StatsSampleMode,
} from "../src/lib/stats/sample-mode";
import { buildHorseRacingPayload } from "../src/lib/horse-racing/engine";
import { buildRacingCalendarPayload } from "../src/lib/horse-racing/calendar";
import {
  exportPerformanceArtifacts,
  persistPerformanceToDurable,
} from "../src/lib/horse-racing/performance-ledger";
import { buildNbaPayload } from "../src/lib/nba/client";
import { SPORTS } from "../src/lib/sports/config";
import {
  liveFootballCompetitions,
  type FootballCompetitionMeta,
} from "../src/lib/sports/football";
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

async function exportSampleMode(
  mode: StatsSampleMode,
  competition: FootballCompetitionMeta
) {
  const tag = `${competition.id}/${mode}`;
  console.log(`\n  [${tag}] exporting sample dataset …`);
  clearFotmobCache();
  clearPlayerIndexCache();
  setActiveFootballCompetition(competition.id);
  setActiveSampleMode(mode);

  const prefix =
    competition.dataRoot === "legacy"
      ? `samples/${mode}`
      : `football/${competition.id}/samples/${mode}`;

  const modeLabel =
    sampleModesForCompetition(competition.id).find((m) => m.id === mode)
      ?.label ?? sampleModeLabel(mode);

  const sampleMeta = {
    sampleMode: mode,
    sampleLabel: modeLabel,
    sourceLabel: modeLabel,
    competitionId: competition.id,
    competitionLabel: competition.label,
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
      console.warn(`  skip match ${id} (${tag}):`, e);
    }
  }

  console.log(`  [${tag}] builder …`);
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

  console.log(`  [${tag}] star players …`);
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

  console.log(`  [${tag}] team model …`);
  const teamHistory = getTeamHistory(mode);
  const teamModel = buildTeamModelPayload(
    teamHistory,
    playerIndex ? [...playerIndex.values()] : [],
    upcoming,
    liveOdds ?? undefined,
    eventUrls.size ? eventUrls : undefined
  );
  await writeJson(`${prefix}/team-model.json`, { ...teamModel, ...sampleMeta });

  // Mirror default mode to competition root (legacy PL → /data, scoped → /data/football/{id})
  if (mode === DEFAULT_SAMPLE_MODE) {
    const rootPrefix =
      competition.dataRoot === "legacy"
        ? ""
        : `football/${competition.id}/`;
    await writeJson(`${rootPrefix}stats/players.json`, {
      ...players,
      ...sampleMeta,
    });
    await writeJson(`${rootPrefix}stats/matches.json`, {
      fixtures,
      ...sampleMeta,
    });
    await writeJson(`${rootPrefix}stats/bankers.json`, {
      bankers,
      ...sampleMeta,
    });
    await writeJson(`${rootPrefix}stats/fixture-ids.json`, {
      ids,
      ...sampleMeta,
    });
    await writeJson(`${rootPrefix}builder.json`, { ...builder, ...sampleMeta });
    await writeJson(`${rootPrefix}star-players.json`, {
      ...starPlayers,
      ...sampleMeta,
    });
    await writeJson(`${rootPrefix}team-model.json`, {
      ...teamModel,
      ...sampleMeta,
    });
    for (const id of ids) {
      try {
        const detail = await loadMatchDetail(id);
        if (detail) {
          await writeJson(`${rootPrefix}stats/match/${id}.json`, {
            ...detail,
            ...sampleMeta,
          });
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
    competitions: liveFootballCompetitions().map((c) => ({
      id: c.id,
      label: c.label,
      live: c.live,
    })),
    exportedAt: new Date().toISOString(),
  });

  for (const competition of liveFootballCompetitions()) {
    console.log(`\n=== Football: ${competition.label} ===`);
    setActiveFootballCompetition(competition.id);
    for (const mode of SAMPLE_MODES) {
      await exportSampleMode(mode.id, competition);
    }
  }

  // Restore PL as active default for any later tooling
  setActiveFootballCompetition("premier-league");

  try {
    const cacheFile = path.join(
      process.cwd(),
      ".cache",
      "bet365-live-odds.json"
    );
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
    console.log(
      `  nba: ${nba.leaders.length} leaders, ${nba.scoreboard.length} games, ${nba.playerProps.length} prop profiles`
    );
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
    const perf = await exportPerformanceArtifacts(
      path.join(ROOT, "horse-racing", "performance")
    );
    console.log(
      `  racing performance: exported ledger=${perf.ledger} predictionLogs=${perf.predictions}`
    );
    const durable = await persistPerformanceToDurable();
    console.log(
      `  racing performance: durable ledger=${durable.ledger} predictionLogs=${durable.predictions}`
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
