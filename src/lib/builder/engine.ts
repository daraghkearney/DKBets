import { getMatchDetails } from "@/lib/stats/fotmob";
import { loadFixtures, loadMatchDetail } from "@/lib/stats/engine";
import { parseFixtures } from "@/lib/stats/parse";
import { getLeagueOverview } from "@/lib/stats/store";
import {
  buildAllTargets,
  buildTodaysPick,
  ODDS_TARGETS,
} from "./compose";
import {
  dedupeLegs,
  legsFromMatchDetail,
  legsFromTeamHistory,
  parseTeamMatchLines,
} from "./legs";
import type { BuilderPayload } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function loadBuilderPayload(): Promise<BuilderPayload> {
  const fixtures = await loadFixtures();
  const allLegs: import("./types").BuilderLeg[] = [];

  for (const fx of fixtures) {
    const detail = await loadMatchDetail(fx.id);
    if (detail) allLegs.push(...legsFromMatchDetail(detail));
  }

  const league = (await getLeagueOverview()) as any;
  const finished = parseFixtures(league).filter((f) => f.finished);
  const teamHist = new Map<
    string,
    ReturnType<typeof parseTeamMatchLines>
  >();

  for (const fx of finished.slice(-40)) {
    try {
      const raw = (await getMatchDetails(fx.id, true)) as any;
      for (const line of parseTeamMatchLines(fx.id, raw, fx.home, fx.away)) {
        if (!teamHist.has(line.teamName)) teamHist.set(line.teamName, []);
        teamHist.get(line.teamName)!.push(line);
      }
    } catch {
      /* skip */
    }
  }

  const upcomingTeams = new Set<string>();
  for (const fx of fixtures) {
    upcomingTeams.add(fx.home);
    upcomingTeams.add(fx.away);
  }

  for (const team of upcomingTeams) {
    const hist = teamHist.get(team) ?? [];
    if (hist.length >= 2) {
      allLegs.push(...legsFromTeamHistory(team, hist, fixtures));
    }
  }

  const pool = dedupeLegs(allLegs);

  return {
    todaysPick: buildTodaysPick(pool),
    builders: buildAllTargets(pool),
    targets: [...ODDS_TARGETS],
    legPoolSize: pool.length,
    generatedAt: new Date().toISOString(),
  };
}
