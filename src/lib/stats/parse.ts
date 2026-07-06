import type { PlayerMatchLine, StatTotals } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STAT_KEYS: Record<string, keyof Omit<PlayerMatchLine, "matchId" | "opponent" | "date" | "competition">> = {
  minutes_played: "minutes",
  goals: "goals",
  assists: "assists",
  total_shots: "shots",
  shots_on_target: "shotsOnTarget",
  ShotsOnTarget: "shotsOnTarget",
  fouls: "foulsCommitted",
  was_fouled: "foulsWon",
  won_tackle: "tackles",
  "matchstats.headers.tackles": "tackles",
  duels_won: "duelsWon",
  yellow_cards: "yellowCards",
  red_cards: "redCards",
};

function resolveStatKey(raw: string): keyof Omit<PlayerMatchLine, "matchId" | "opponent" | "date" | "competition"> | null {
  const direct = STAT_KEYS[raw];
  if (direct) return direct;
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(STAT_KEYS)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

export function statValue(stat: any): number {
  if (!stat?.stat) return 0;
  const v = stat.stat.value;
  return typeof v === "number" ? v : Number(v) || 0;
}

/** Flatten FotMob matchDetails.content.playerStats into per-player lines. */
export function parseMatchPlayerLines(
  matchId: number,
  payload: any,
  competition = "World Cup"
): Map<number, PlayerMatchLine> {
  const out = new Map<number, PlayerMatchLine>();
  const ps = payload?.content?.playerStats;
  if (!ps || typeof ps !== "object") return out;

  const header = payload?.general ?? payload?.header ?? {};
  const home = header.homeTeam?.name ?? header.homeTeam?.shortName ?? "?";
  const away = header.awayTeam?.name ?? header.awayTeam?.shortName ?? "?";
  const date =
    header.matchDateUTCDate ??
    payload?.general?.matchTimeUTCDate ??
    new Date().toISOString().slice(0, 10);

  for (const raw of Object.values(ps) as any[]) {
    const id = Number(raw.id);
    if (!id) continue;
    const line: PlayerMatchLine = {
      matchId,
      opponent: raw.teamName === home ? away : home,
      date: String(date),
      competition,
      minutes: 0,
      goals: 0,
      assists: 0,
      shots: 0,
      shotsOnTarget: 0,
      foulsCommitted: 0,
      foulsWon: 0,
      tackles: 0,
      duelsWon: 0,
      yellowCards: 0,
      redCards: 0,
    };

    for (const section of raw.stats ?? []) {
      for (const [title, entry] of Object.entries(section.stats ?? {})) {
        const key = (entry as any)?.key ?? title;
        const mapped = resolveStatKey(key as string);
        if (mapped) (line as any)[mapped] = statValue(entry);
      }
    }
    out.set(id, line);
  }
  return out;
}

/** Player name/team from matchDetails.content.playerStats. */
export function parsePlayerMeta(
  payload: any
): Map<number, { name: string; teamId: number; teamName: string }> {
  const meta = new Map<number, { name: string; teamId: number; teamName: string }>();
  const ps = payload?.content?.playerStats;
  if (!ps || typeof ps !== "object") return meta;

  for (const p of Object.values(ps) as any[]) {
    const id = Number(p.id);
    if (!id || !p.name) continue;
    meta.set(id, {
      name: p.name,
      teamId: Number(p.teamId) || 0,
      teamName: p.teamName ?? "",
    });
  }
  return meta;
}

export function emptyTotals(): StatTotals {
  return {
    matches: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    foulsCommitted: 0,
    foulsWon: 0,
    tackles: 0,
    duelsWon: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

export function sumLines(lines: PlayerMatchLine[]): StatTotals {
  const t = emptyTotals();
  for (const l of lines) {
    t.matches += 1;
    t.minutes += l.minutes;
    t.goals += l.goals;
    t.assists += l.assists;
    t.shots += l.shots;
    t.shotsOnTarget += l.shotsOnTarget;
    t.foulsCommitted += l.foulsCommitted;
    t.foulsWon += l.foulsWon;
    t.tackles += l.tackles;
    t.duelsWon += l.duelsWon;
    t.yellowCards += l.yellowCards;
    t.redCards += l.redCards;
  }
  return t;
}

export function per90(totals: StatTotals): StatTotals {
  if (totals.minutes <= 0) return { ...totals, matches: totals.matches };
  const f = 90 / totals.minutes;
  return {
    matches: totals.matches,
    minutes: totals.minutes,
    goals: r(totals.goals * f),
    assists: r(totals.assists * f),
    shots: r(totals.shots * f),
    shotsOnTarget: r(totals.shotsOnTarget * f),
    foulsCommitted: r(totals.foulsCommitted * f),
    foulsWon: r(totals.foulsWon * f),
    tackles: r(totals.tackles * f),
    duelsWon: r(totals.duelsWon * f),
    yellowCards: r(totals.yellowCards * f),
    redCards: r(totals.redCards * f),
  };
}

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface RawFixture {
  id: number;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  kickoff: string;
  stage: string;
  started: boolean;
  finished: boolean;
  roundName: string;
}

export function parseFixtures(league: any): RawFixture[] {
  const out: RawFixture[] = [];
  for (const rnd of league?.fixtures?.allMatches ?? []) {
    const stage = rnd.roundName ?? rnd.round ?? "World Cup";
    const matches =
      Array.isArray(rnd.matches) && rnd.matches.length > 0
        ? rnd.matches
        : rnd?.home?.name
          ? [rnd]
          : [];
    for (const m of matches) {
      if (!m?.home?.name) continue;
      out.push({
        id: Number(m.id),
        home: m.home.name,
        away: m.away.name,
        homeId: Number(m.home.id),
        awayId: Number(m.away.id),
        kickoff: m.status?.utcTime ?? "",
        stage,
        started: Boolean(m.status?.started),
        finished: Boolean(m.status?.finished),
        roundName: stage,
      });
    }
  }
  return out;
}

export function parseLineupSide(team: any, teamName: string): import("./types").LineupPlayer[] {
  const starters = team?.starters ?? [];
  return starters.map((p: any) => {
    const band = bandFromPositionId(p.positionId);
    const side = lateralFromY(p.horizontalLayout?.y);
    return {
      id: p.id,
      name: p.name,
      shirtNumber: String(p.shirtNumber ?? ""),
      positionLabel: labelFor(band, side),
      band,
      x: p.horizontalLayout?.x ?? 0.5,
      y: p.horizontalLayout?.y ?? 0.5,
    };
  });
}

function bandFromPositionId(pid: number): "GK" | "DF" | "MF" | "FW" {
  if (pid === 11) return "GK";
  if (pid <= 38) return "DF";
  if (pid <= 77) return "MF";
  return "FW";
}

function lateralFromY(y: number | undefined): "L" | "C" | "R" {
  if (y == null) return "C";
  // FotMob horizontalLayout.y: low = left flank, high = right flank
  if (y < 0.35) return "L";
  if (y > 0.65) return "R";
  return "C";
}

function labelFor(band: string, side: string): string {
  if (band === "GK") return "Goalkeeper";
  if (band === "DF") {
    if (side === "L") return "Left-Back";
    if (side === "R") return "Right-Back";
    return "Centre-Back";
  }
  if (band === "MF") {
    if (side === "L") return "Left Midfielder";
    if (side === "R") return "Right Midfielder";
    return "Central Midfielder";
  }
  if (side === "L") return "Left Winger";
  if (side === "R") return "Right Winger";
  return "Striker";
}

export function lineupType(payload: any): "confirmed" | "predicted" | "none" {
  const t = payload?.content?.lineup?.lineupType;
  if (t === "confirmed" || t === "actual") return "confirmed";
  if (t === "predicted" || t === "possible") return "predicted";
  const starters =
    payload?.content?.lineup?.homeTeam?.starters?.length ?? 0;
  return starters >= 11 ? "predicted" : "none";
}
