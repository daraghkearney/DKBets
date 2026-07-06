/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TeamMatchLine {
  matchId: number;
  teamName: string;
  opponent: string;
  shots: number;
  shotsOnTarget: number;
  fouls: number;
  yellowCards: number;
  corners: number;
}

function parseNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(/[^\d.]/g, "")) || 0;
  return 0;
}

/** Extract home/away team stat pairs from FotMob match stats (All period). */
export function parseTeamMatchLines(
  matchId: number,
  payload: any,
  homeName: string,
  awayName: string
): TeamMatchLine[] {
  const sections = payload?.content?.stats?.Periods?.All?.stats ?? [];
  const pairs: Record<string, [number, number]> = {};

  for (const section of sections) {
    for (const row of section?.stats ?? []) {
      if (!row || typeof row !== "object" || !Array.isArray(row.stats)) continue;
      const key = row.key ?? row.title;
      if (typeof key !== "string") continue;
      pairs[key] = [parseNum(row.stats[0]), parseNum(row.stats[1])];
    }
  }

  const shots = pairs.total_shots ?? [0, 0];
  const sot = pairs.ShotsOnTarget ?? [0, 0];
  const fouls = pairs.fouls ?? [0, 0];
  const yc = pairs.yellow_cards ?? [0, 0];
  const corners =
    pairs.corner_kicks ??
    pairs.Corners ??
    pairs.corners ??
    pairs.CornerKicks ?? [0, 0];

  return [
    {
      matchId,
      teamName: homeName,
      opponent: awayName,
      shots: shots[0],
      shotsOnTarget: sot[0],
      fouls: fouls[0],
      yellowCards: yc[0],
      corners: corners[0],
    },
    {
      matchId,
      teamName: awayName,
      opponent: homeName,
      shots: shots[1],
      shotsOnTarget: sot[1],
      fouls: fouls[1],
      yellowCards: yc[1],
      corners: corners[1],
    },
  ];
}

export function normTeamKey(team: string): string {
  const t = team.trim().toLowerCase().replace(/\./g, "");
  if (t === "united states") return "usa";
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

export function indexTeamLines(
  lines: TeamMatchLine[]
): Map<string, TeamMatchLine[]> {
  const out = new Map<string, TeamMatchLine[]>();
  for (const line of lines) {
    const key = normTeamKey(line.teamName);
    if (!out.has(key)) out.set(key, []);
    out.get(key)!.push(line);
  }
  return out;
}
