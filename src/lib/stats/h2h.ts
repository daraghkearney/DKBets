/**
 * Career head-to-head discovery via FotMob playerData.recentMatches.
 * Finds pairs like Gabriel vs Haaland who've faced each other at club level.
 */

import { getMatchDetails, getPlayerData, pool } from "./fotmob";
import { parseMatchPlayerLines } from "./parse";
import type { LineupPlayer, MatchupHistoryRow, PlayerMatchLine } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RecentMatchMeta {
  matchId: number;
  date: string;
  competition: string;
  score: string;
  teamId: number;
}

interface PlayerMatchIndex {
  playerId: number;
  matchIds: Set<number>;
  meta: Map<number, RecentMatchMeta>;
}

export interface H2HPair {
  home: LineupPlayer;
  away: LineupPlayer;
  sharedCount: number;
  sharedIds: number[];
  tag: string;
}

export type H2HLookup = Map<string, { sharedIds: number[]; count: number }>;

export function pairKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}-${bId}` : `${bId}-${aId}`;
}

export function buildH2HLookup(pairs: H2HPair[]): H2HLookup {
  const map: H2HLookup = new Map();
  for (const p of pairs) {
    map.set(pairKey(p.home.id, p.away.id), {
      sharedIds: p.sharedIds,
      count: p.sharedCount,
    });
  }
  return map;
}

export function lookupH2H(
  lookup: H2HLookup,
  aId: number,
  bId: number
): { sharedIds: number[]; count: number } {
  return lookup.get(pairKey(aId, bId)) ?? { sharedIds: [], count: 0 };
}

const playerIndexCache = new Map<number, PlayerMatchIndex>();
const playerIndexBuiltAt = new Map<number, number>();
const matchLinesCache = new Map<number, Map<number, PlayerMatchLine>>();
const PLAYER_INDEX_TTL = 6 * 60 * 60_000;

export async function loadPlayerMatchIndex(playerId: number): Promise<PlayerMatchIndex> {
  const cached = playerIndexCache.get(playerId);
  const built = playerIndexBuiltAt.get(playerId) ?? 0;
  const sample = cached?.meta.values().next().value;
  if (
    cached &&
    Date.now() - built < PLAYER_INDEX_TTL &&
    sample &&
    "teamId" in sample
  ) {
    return cached;
  }

  const data = (await getPlayerData(playerId)) as any;
  const matchIds = new Set<number>();
  const meta = new Map<number, RecentMatchMeta>();

  for (const m of data?.recentMatches ?? []) {
    if (!m?.playedInMatch) continue;
    const id = Number(m.id);
    if (!id) continue;
    matchIds.add(id);
    const date =
      m.matchDate?.utcTime ??
      m.matchDate ??
      "";
    meta.set(id, {
      matchId: id,
      date: String(date).slice(0, 10),
      competition: m.leagueName ?? m.stage ?? "Club / International",
      score: `${m.homeScore ?? 0}–${m.awayScore ?? 0}`,
      teamId: Number(m.teamId),
    });
  }

  const idx: PlayerMatchIndex = { playerId, matchIds, meta };
  playerIndexCache.set(playerId, idx);
  playerIndexBuiltAt.set(playerId, Date.now());
  return idx;
}

/** Cross-reference recent match lists to find lineup players with shared history. */
export async function discoverH2HPairs(
  homePlayers: LineupPlayer[],
  awayPlayers: LineupPlayer[]
): Promise<H2HPair[]> {
  const ids = [...homePlayers, ...awayPlayers]
    .filter((p) => p.band !== "GK")
    .map((p) => p.id);
  const indexes = await pool(ids, 6, loadPlayerMatchIndex);
  const byId = new Map<number, PlayerMatchIndex>();
  ids.forEach((id, i) => {
    const idx = indexes[i];
    if (idx) byId.set(id, idx);
  });

  const pairs: H2HPair[] = [];
  for (const h of homePlayers) {
    if (h.band === "GK") continue;
    const hi = byId.get(h.id);
    if (!hi) continue;
    for (const a of awayPlayers) {
      if (a.band === "GK") continue;
      const ai = byId.get(a.id);
      if (!ai) continue;
      const sharedIds = [...hi.matchIds].filter((id) => {
        if (!ai.matchIds.has(id)) return false;
        const hMeta = hi.meta.get(id);
        const aMeta = ai.meta.get(id);
        if (!hMeta || !aMeta) return false;
        // Same match, opposite teams only — not club teammates.
        return hMeta.teamId !== aMeta.teamId;
      });
      if (sharedIds.length === 0) continue;
      const tactical =
        (h.band === "DF" && a.band === "FW") ||
        (h.band === "FW" && a.band === "DF");
      if (sharedIds.length < 2 && !tactical) continue;
      pairs.push({
        home: h,
        away: a,
        sharedCount: sharedIds.length,
        sharedIds,
        tag: rivalryTag(h, a),
      });
    }
  }

  return pairs.sort((x, y) => y.sharedCount - x.sharedCount);
}

function rivalryTag(h: LineupPlayer, a: LineupPlayer): string {
  if (h.band === "DF" && a.band === "FW") return "Centre-Back vs Striker";
  if (h.band === "FW" && a.band === "DF") return "Striker vs Centre-Back";
  if (h.band === "DF" && a.band === "FW" && a.positionLabel.includes("Wing")) {
    return `${h.positionLabel} vs ${a.positionLabel}`;
  }
  return `${h.positionLabel} vs ${a.positionLabel}`;
}

/** Tournament overlap + career meetings parsed from FotMob match details. */
export async function buildCareerHistory(
  aId: number,
  bId: number,
  sharedIds: number[],
  tournamentRows: MatchupHistoryRow[]
): Promise<MatchupHistoryRow[]> {
  const seen = new Set(tournamentRows.map((r) => r.matchId));
  const extraIds = sharedIds.filter((id) => !seen.has(id));
  const rows = [...tournamentRows];

  if (extraIds.length === 0) return rows.sort((x, y) => y.date.localeCompare(x.date));

  const metaA = playerIndexCache.get(aId)?.meta;
  const metaB = playerIndexCache.get(bId)?.meta;

  await pool(extraIds, 4, async (matchId) => {
    const lines = await getCachedMatchLines(matchId);
    const la = lines.get(aId);
    const lb = lines.get(bId);
    if (!la || !lb) return;
    const meta = metaA?.get(matchId) ?? metaB?.get(matchId);
    rows.push({
      matchId,
      date: meta?.date ?? la.date,
      competition: meta?.competition ?? la.competition,
      score: meta?.score ?? "",
      a: la,
      b: lb,
    });
  });

  return rows.sort((x, y) => y.date.localeCompare(x.date));
}

async function getCachedMatchLines(
  matchId: number
): Promise<Map<number, PlayerMatchLine>> {
  const hit = matchLinesCache.get(matchId);
  if (hit) return hit;
  const raw = (await getMatchDetails(matchId, true)) as any;
  const map = parseMatchPlayerLines(matchId, raw);
  matchLinesCache.set(matchId, map);
  return map;
}
