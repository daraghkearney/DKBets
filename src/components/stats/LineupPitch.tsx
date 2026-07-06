"use client";

import PlayerAvatar from "@/components/stats/PlayerAvatar";
import type { LineupPlayer } from "@/lib/stats/types";

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts[parts.length - 1];
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
  const top = `${player.y * 84 + 8}%`;
  const left =
    side === "home"
      ? `${player.x * 44 + 3}%`
      : `${(1 - player.x) * 44 + 53}%`;

  return (
    <div
      className={`absolute flex w-[11%] min-w-[52px] max-w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-200 ${
        highlighted ? "z-20 scale-110" : "z-10"
      }`}
      style={{ left, top }}
      title={player.name}
    >
      <div
        className={`relative rounded-full ${
          highlighted
            ? "ring-2 ring-gold ring-offset-2 ring-offset-[#1a4d2e] shadow-[0_0_18px_rgba(251,191,36,0.55)]"
            : ""
        }`}
      >
        <PlayerAvatar playerId={player.id} name={player.name} size={36} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-background/90 px-0.5 text-[9px] font-bold tabular text-foreground">
          {player.shirtNumber || "·"}
        </span>
      </div>
      <span
        className={`mt-0.5 max-w-full truncate text-center text-[9px] font-semibold leading-tight ${
          highlighted ? "text-gold" : "text-foreground/90"
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
}: {
  players: LineupPlayer[];
  highlightedIds: Set<number>;
}) {
  if (players.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {players.map((p) => {
        const on = highlightedIds.has(p.id);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${
              on
                ? "border-gold/60 bg-gold/15 text-gold"
                : "border-edge/60 bg-background/40 text-muted"
            }`}
            title={p.name}
          >
            <span className="font-bold tabular text-foreground/80">
              {p.shirtNumber}
            </span>
            <span className="max-w-[72px] truncate">{shortName(p.name)}</span>
          </div>
        );
      })}
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

  if (homeLineup.length < 11 && awayLineup.length < 11) {
    return (
      <p className="rounded-xl border border-edge bg-surface px-4 py-8 text-center text-sm text-muted">
        Lineups not published yet — check back closer to kickoff.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-surface">
      <div className="grid grid-cols-2 gap-2 border-b border-edge/60 px-4 py-2.5 text-xs">
        <div>
          <p className="font-bold text-foreground">{homeTeam}</p>
          {homeFormation && (
            <p className="text-[11px] text-muted">{homeFormation}</p>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-foreground">{awayTeam}</p>
          {awayFormation && (
            <p className="text-[11px] text-muted">{awayFormation}</p>
          )}
        </div>
      </div>

      <div
        className={`relative mx-2 my-3 aspect-[16/10] overflow-hidden rounded-xl border border-white/10 bg-[#1a4d2e] ${
          dashed ? "opacity-95" : ""
        }`}
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "12.5% 20%",
        }}
      >
        {/* Halfway line */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/25" />
        {/* Centre circle */}
        <div className="absolute left-1/2 top-1/2 h-[22%] w-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        {/* Penalty areas */}
        <div className="absolute left-0 top-1/2 h-[44%] w-[14%] -translate-y-1/2 border-y border-r border-white/15" />
        <div className="absolute right-0 top-1/2 h-[44%] w-[14%] -translate-y-1/2 border-y border-l border-white/15" />

        {dashed && (
          <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-white/20" />
        )}

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

      {(homeBench?.length || awayBench?.length) ? (
        <div className="grid grid-cols-1 gap-3 border-t border-edge/60 px-4 py-3 sm:grid-cols-2">
          {homeBench && homeBench.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                {homeTeam} subs
              </p>
              <BenchRow players={homeBench} highlightedIds={highlight} />
            </div>
          )}
          {awayBench && awayBench.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                {awayTeam} subs
              </p>
              <BenchRow players={awayBench} highlightedIds={highlight} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
