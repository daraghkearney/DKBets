import type { LineupPlayer } from "./types";
import { lookupH2H, type H2HLookup } from "./h2h";

/** Canonical positional duel slots — order preserved for UI. */
export const POSITIONAL_SLOTS: Array<{
  tag: string;
  home: { band: LineupPlayer["band"]; side: "L" | "C" | "R" };
  away: { band: LineupPlayer["band"]; side: "L" | "C" | "R" };
  /** Prefer defender/winger with career H2H vs their direct opponent. */
  preferH2H?: boolean;
}> = [
  {
    tag: "Left-Back vs Right Winger",
    home: { band: "DF", side: "L" },
    away: { band: "FW", side: "R" },
    preferH2H: true,
  },
  {
    tag: "Right-Back vs Left Winger",
    home: { band: "DF", side: "R" },
    away: { band: "FW", side: "L" },
    preferH2H: true,
  },
  {
    tag: "Left Winger vs Right-Back",
    home: { band: "FW", side: "L" },
    away: { band: "DF", side: "R" },
    preferH2H: true,
  },
  {
    tag: "Right Winger vs Left-Back",
    home: { band: "FW", side: "R" },
    away: { band: "DF", side: "L" },
    preferH2H: true,
  },
  {
    tag: "Centre-Back vs Striker",
    home: { band: "DF", side: "C" },
    away: { band: "FW", side: "C" },
    preferH2H: true,
  },
  {
    tag: "Striker vs Centre-Back",
    home: { band: "FW", side: "C" },
    away: { band: "DF", side: "C" },
    preferH2H: true,
  },
  {
    tag: "Central Midfielder vs Central Midfielder",
    home: { band: "MF", side: "C" },
    away: { band: "MF", side: "C" },
  },
  {
    tag: "Left Midfielder vs Right Midfielder",
    home: { band: "MF", side: "L" },
    away: { band: "MF", side: "R" },
  },
  {
    tag: "Right Midfielder vs Left Midfielder",
    home: { band: "MF", side: "R" },
    away: { band: "MF", side: "L" },
  },
];

export interface PositionalPair {
  home: LineupPlayer;
  away: LineupPlayer;
  tag: string;
  slotOrder: number;
}

export function buildPositionalMatchups(
  home: LineupPlayer[],
  away: LineupPlayer[],
  h2h: H2HLookup
): PositionalPair[] {
  const pairs: PositionalPair[] = [];

  POSITIONAL_SLOTS.forEach((spec, slotOrder) => {
    const h = pickForSlot(
      home,
      spec.home.band,
      spec.home.side,
      spec.preferH2H
        ? pickOpponent(away, spec.away.band, spec.away.side, h2h, home)
        : null,
      h2h,
      away
    );
    const a = pickForSlot(away, spec.away.band, spec.away.side, spec.preferH2H ? h : null, h2h, home);
    if (h && a) pairs.push({ home: h, away: a, tag: spec.tag, slotOrder });
  });

  return dedupe(pairs);
}

/** Pick the opponent on the other flank first so H2H can inform the home pick. */
function pickOpponent(
  players: LineupPlayer[],
  band: LineupPlayer["band"],
  side: "L" | "C" | "R",
  _h2h: H2HLookup,
  _otherTeam: LineupPlayer[]
): LineupPlayer | null {
  return pickForSlot(players, band, side, null, _h2h, _otherTeam);
}

function pickForSlot(
  players: LineupPlayer[],
  band: LineupPlayer["band"],
  side: "L" | "C" | "R",
  opponent: LineupPlayer | null,
  h2h: H2HLookup,
  otherTeam: LineupPlayer[]
): LineupPlayer | null {
  const pool = players.filter((p) => p.band === band && p.band !== "GK");
  if (!pool.length) return null;

  const onSide = pool.filter((p) => sideFrom(p) === side);
  const candidates = onSide.length ? onSide : pool;

  if (opponent && candidates.length > 1) {
    const ranked = candidates
      .map((p) => ({
        p,
        h2h: lookupH2H(h2h, p.id, opponent.id).count,
        sideMatch: sideFrom(p) === side ? 0 : 1,
        depth: depth(p),
      }))
      .sort(
        (x, y) =>
          y.h2h - x.h2h ||
          x.sideMatch - y.sideMatch ||
          x.depth - y.depth
      );
    if (ranked[0]) return ranked[0].p;
  }

  return candidates.sort((a, b) => depth(a) - depth(b))[0] ?? null;
}

function sideFrom(p: LineupPlayer): "L" | "C" | "R" {
  if (p.y < 0.35) return "R";
  if (p.y > 0.65) return "L";
  return "C";
}

function depth(p: LineupPlayer): number {
  return p.x;
}

function dedupe(pairs: PositionalPair[]): PositionalPair[] {
  const seen = new Set<string>();
  return pairs.filter((p) => {
    const k = `${p.home.id}-${p.away.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** @deprecated use buildPositionalMatchups */
export function buildFlankMatchups(
  home: LineupPlayer[],
  away: LineupPlayer[]
): Array<{ home: LineupPlayer; away: LineupPlayer; tag: string }> {
  return buildPositionalMatchups(home, away, new Map()).map(
    ({ home: h, away: a, tag }) => ({ home: h, away: a, tag })
  );
}
