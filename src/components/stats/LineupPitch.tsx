"use client";

import { useMemo } from "react";
import PlayerAvatar from "@/components/stats/PlayerAvatar";
import type { LineupPlayer } from "@/lib/stats/types";

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts[parts.length - 1];
}

/**
 * Map FotMob horizontalLayout to pitch CSS percentages.
 * Home: raw x/y (team faces right). Away: mirror depth (x) and flip lateral (y) —
 * FotMob stores away coords from the team's POV facing left on their split view.
 */
export function pitchCoords(player: LineupPlayer, side: "home" | "away") {
  const depth = side === "home" ? player.x : 1 - player.x;
  const lateral = side === "away" ? 1 - player.y : player.y;
  const left = side === "home" ? depth * 44 + 3 : depth * 44 + 53;
  const top = lateral * 84 + 8;
  return { left, top };
}

function PitchMarkings() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 62.5"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="pitch-line-glow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
        </linearGradient>
        <radialGradient id="center-spot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.4)" />
        </radialGradient>
      </defs>

      {/* Outer boundary */}
      <rect
        x="1.5"
        y="1.5"
        width="97"
        height="59.5"
        fill="none"
        stroke="url(#pitch-line-glow)"
        strokeWidth="0.35"
        rx="0.5"
      />

      {/* Halfway */}
      <line
        x1="50"
        y1="1.5"
        x2="50"
        y2="61"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.25"
      />

      {/* Centre circle + spot */}
      <circle
        cx="50"
        cy="31.25"
        r="7.5"
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.25"
      />
      <circle cx="50" cy="31.25" r="0.55" fill="url(#center-spot)" />

      {/* Left penalty area */}
      <rect
        x="1.5"
        y="17"
        width="11"
        height="28.5"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.22"
      />
      <rect
        x="1.5"
        y="23.5"
        width="5"
        height="15.5"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.18"
      />
      <circle cx="9" cy="31.25" r="0.45" fill="rgba(255,255,255,0.55)" />
      <path
        d="M 12.5 24.5 A 7.5 7.5 0 0 1 12.5 38"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.18"
      />

      {/* Right penalty area */}
      <rect
        x="87.5"
        y="17"
        width="11"
        height="28.5"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.22"
      />
      <rect
        x="93.5"
        y="23.5"
        width="5"
        height="15.5"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.18"
      />
      <circle cx="91" cy="31.25" r="0.45" fill="rgba(255,255,255,0.55)" />
      <path
        d="M 87.5 24.5 A 7.5 7.5 0 0 0 87.5 38"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.18"
      />

      {/* Corner arcs */}
      <path
        d="M 1.5 3.5 A 2 2 0 0 0 3.5 1.5"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.15"
      />
      <path
        d="M 1.5 59 A 2 2 0 0 1 3.5 61"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.15"
      />
      <path
        d="M 98.5 3.5 A 2 2 0 0 1 96.5 1.5"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.15"
      />
      <path
        d="M 98.5 59 A 2 2 0 0 0 96.5 61"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.15"
      />
    </svg>
  );
}

function DuelConnector({
  home,
  away,
}: {
  home: { left: number; top: number };
  away: { left: number; top: number };
}) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[15] h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="duel-beam" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(251,191,36,0.1)" />
          <stop offset="50%" stopColor="rgba(251,191,36,0.85)" />
          <stop offset="100%" stopColor="rgba(251,191,36,0.1)" />
        </linearGradient>
      </defs>
      <line
        x1={`${home.left}%`}
        y1={`${home.top}%`}
        x2={`${away.left}%`}
        y2={`${away.top}%`}
        stroke="url(#duel-beam)"
        strokeWidth="2"
        strokeDasharray="6 4"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle
        cx={`${home.left}%`}
        cy={`${home.top}%`}
        r="4"
        fill="rgba(251,191,36,0.35)"
      />
      <circle
        cx={`${away.left}%`}
        cy={`${away.top}%`}
        r="4"
        fill="rgba(251,191,36,0.35)"
      />
    </svg>
  );
}

function PitchPlayer({
  player,
  side,
  highlighted,
}: {
  player: LineupPlayer;
  side: "home" | "away";
  highlighted: boolean;
}) {
  const { left, top } = pitchCoords(player, side);
  const accent =
    side === "home"
      ? "from-emerald-400/30 to-cyan-500/10"
      : "from-rose-400/30 to-orange-500/10";

  return (
    <div
      className={`absolute flex w-[11%] min-w-[54px] max-w-[76px] -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-300 ${
        highlighted ? "z-30 scale-[1.15]" : "z-20 hover:z-25 hover:scale-105"
      }`}
      style={{ left: `${left}%`, top: `${top}%` }}
      title={`${player.name} · ${player.positionLabel}`}
    >
      {highlighted && (
        <div className="absolute -inset-3 rounded-full bg-gold/20 blur-md lineup-pitch-shimmer" />
      )}

      <div
        className={`relative rounded-2xl border p-0.5 backdrop-blur-sm transition-all ${
          highlighted
            ? "lineup-player-glow border-gold/70 bg-gold/10"
            : `border-white/15 bg-gradient-to-b ${accent} bg-black/30`
        }`}
      >
        <div className="relative">
          <PlayerAvatar playerId={player.id} name={player.name} size={40} />
          <span
            className={`absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black tabular shadow-lg ${
              highlighted
                ? "bg-gold text-background"
                : side === "home"
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white"
            }`}
          >
            {player.shirtNumber || "·"}
          </span>
        </div>
      </div>

      <span
        className={`mt-1 max-w-full truncate rounded-md px-1.5 py-0.5 text-center text-[9px] font-bold leading-tight backdrop-blur-sm ${
          highlighted
            ? "bg-gold/25 text-gold shadow-[0_0_12px_rgba(251,191,36,0.4)]"
            : "bg-black/50 text-white/90"
        }`}
      >
        {shortName(player.name)}
      </span>
    </div>
  );
}

function BenchRow({
  players,
  highlightedIds,
  accent,
}: {
  players: LineupPlayer[];
  highlightedIds: Set<number>;
  accent: "home" | "away";
}) {
  if (players.length === 0) return null;
  const chip =
    accent === "home"
      ? "border-emerald-500/25 bg-emerald-500/5"
      : "border-rose-500/25 bg-rose-500/5";

  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => {
        const on = highlightedIds.has(p.id);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] transition-all ${
              on
                ? "border-gold/60 bg-gold/15 text-gold shadow-[0_0_14px_rgba(251,191,36,0.25)]"
                : `${chip} text-muted hover:border-white/20`
            }`}
            title={p.name}
          >
            <PlayerAvatar playerId={p.id} name={p.name} size={22} />
            <span className="font-bold tabular text-foreground/80">
              {p.shirtNumber}
            </span>
            <span className="max-w-[80px] truncate font-medium">
              {shortName(p.name)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TeamHeader({
  name,
  formation,
  side,
}: {
  name: string;
  formation: string | null;
  side: "home" | "away";
}) {
  const gradient =
    side === "home"
      ? "from-emerald-500/80 to-cyan-400/40"
      : "from-rose-500/80 to-orange-400/40";

  return (
    <div
      className={`flex items-center gap-3 ${side === "away" ? "flex-row-reverse text-right" : ""}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-sm font-black text-white shadow-lg`}
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight text-foreground">
          {name}
        </p>
        {formation && (
          <p className="text-[11px] font-medium text-muted">{formation}</p>
        )}
      </div>
    </div>
  );
}

export default function LineupPitch({
  homeTeam,
  awayTeam,
  homeFormation,
  awayFormation,
  homeLineup,
  awayLineup,
  homeBench,
  awayBench,
  highlightedPlayerIds = [],
  dashed = false,
}: {
  homeTeam: string;
  awayTeam: string;
  homeFormation: string | null;
  awayFormation: string | null;
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  homeBench?: LineupPlayer[];
  awayBench?: LineupPlayer[];
  highlightedPlayerIds?: number[];
  dashed?: boolean;
}) {
  const highlight = new Set(highlightedPlayerIds);

  const duelLine = useMemo(() => {
    if (highlightedPlayerIds.length !== 2) return null;
    const [aId, bId] = highlightedPlayerIds;
    const homeP = homeLineup.find((p) => p.id === aId || p.id === bId);
    const awayP = awayLineup.find((p) => p.id === aId || p.id === bId);
    if (!homeP || !awayP) return null;
    return {
      home: pitchCoords(homeP, "home"),
      away: pitchCoords(awayP, "away"),
    };
  }, [highlightedPlayerIds, homeLineup, awayLineup]);

  if (homeLineup.length < 11 && awayLineup.length < 11) {
    return (
      <p className="rounded-xl border border-edge bg-surface px-4 py-8 text-center text-sm text-muted">
        Lineups not published yet — check back closer to kickoff.
      </p>
    );
  }

  return (
    <div className="lineup-card-border overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.45)]">
      {/* Header */}
      <div className="relative border-b border-white/5 bg-gradient-to-r from-surface via-surface-2 to-surface px-4 py-3">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.08),transparent_60%)]" />
        <div className="relative grid grid-cols-2 gap-4">
          <TeamHeader
            name={homeTeam}
            formation={homeFormation}
            side="home"
          />
          <TeamHeader
            name={awayTeam}
            formation={awayFormation}
            side="away"
          />
        </div>
      </div>

      {/* Pitch */}
      <div className="relative bg-[#060a12] p-3 sm:p-4">
        <div
          className={`relative aspect-[16/10] overflow-hidden rounded-2xl shadow-[inset_0_0_80px_rgba(0,0,0,0.6)] ${
            dashed ? "ring-1 ring-gold/30 ring-offset-2 ring-offset-[#060a12]" : ""
          }`}
        >
          {/* Grass layers */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                repeating-linear-gradient(
                  90deg,
                  rgba(0,0,0,0.03) 0px,
                  rgba(0,0,0,0.03) 6.25%,
                  transparent 6.25%,
                  transparent 12.5%
                ),
                linear-gradient(180deg, #1b5e34 0%, #247a42 35%, #1e6b3a 65%, #165830 100%)
              `,
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.45)_100%)]" />
          <div className="lineup-pitch-shimmer absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.07),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(255,255,255,0.05),transparent_45%)]" />

          {/* Team halves tint */}
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-emerald-400/[0.07] to-transparent" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-rose-400/[0.07] to-transparent" />

          {dashed && (
            <div className="pointer-events-none absolute inset-3 rounded-xl border border-dashed border-gold/35 bg-gold/[0.03]" />
          )}

          <PitchMarkings />

          {duelLine && <DuelConnector home={duelLine.home} away={duelLine.away} />}

          {homeLineup.map((p) => (
            <PitchPlayer
              key={`h-${p.id}`}
              player={p}
              side="home"
              highlighted={highlight.has(p.id)}
            />
          ))}
          {awayLineup.map((p) => (
            <PitchPlayer
              key={`a-${p.id}`}
              player={p}
              side="away"
              highlighted={highlight.has(p.id)}
            />
          ))}
        </div>
      </div>

      {/* Bench */}
      {(homeBench?.length || awayBench?.length) ? (
        <div className="grid grid-cols-1 gap-4 border-t border-white/5 bg-surface/80 px-4 py-4 sm:grid-cols-2">
          {homeBench && homeBench.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400/80">
                <span className="h-px flex-1 bg-emerald-500/30" />
                {homeTeam} subs
                <span className="h-px flex-1 bg-emerald-500/30" />
              </p>
              <BenchRow
                players={homeBench}
                highlightedIds={highlight}
                accent="home"
              />
            </div>
          )}
          {awayBench && awayBench.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-rose-400/80">
                <span className="h-px flex-1 bg-rose-500/30" />
                {awayTeam} subs
                <span className="h-px flex-1 bg-rose-500/30" />
              </p>
              <BenchRow
                players={awayBench}
                highlightedIds={highlight}
                accent="away"
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
