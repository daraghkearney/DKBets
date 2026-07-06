"use client";

import Link from "next/link";
import { formatKickoff, formatPct } from "@/lib/format";
import type { StarPlayerSpecial } from "@/lib/builder/star-player";
import PlayerAvatar from "@/components/stats/PlayerAvatar";
import BuilderSlipCard from "@/components/builder/BuilderSlipCard";

export default function StarPlayerCard({
  entry,
  liveOdds,
}: {
  entry: StarPlayerSpecial;
  liveOdds?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-gold/35 bg-gradient-to-br from-gold/10 via-surface to-surface p-5">
      <div className="flex flex-wrap items-start gap-4">
        <PlayerAvatar
          playerId={entry.playerId}
          name={entry.playerName}
          size={72}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gold">
            Star Player Special
          </p>
          <h2 className="text-xl font-bold tracking-tight">
            {entry.playerName}
          </h2>
          <p className="text-sm text-muted">
            {entry.teamName}
            {entry.positionLabel ? ` · ${entry.positionLabel}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">
            <Link
              href={`/matches/${entry.matchId}/`}
              className="text-[#3ecf8e] underline hover:no-underline"
            >
              {entry.matchLabel}
            </Link>
            {" · "}
            {entry.stage} · {formatKickoff(entry.kickoff)} UTC
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-gold/30 bg-background/40 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gold">
          Standout gem stat
        </p>
        <p className="mt-1 text-lg font-semibold">{entry.gemStat.label}</p>
        <p className="mt-1 tabular text-2xl font-black text-[#3ecf8e]">
          {formatPct(entry.gemStat.hitRate, 1)}
        </p>
        <p className="text-xs text-muted">
          {entry.gemStat.tournamentHits}/{entry.gemStat.tournamentSample}{" "}
          tournament games
          {entry.gemStat.h2hSample
            ? ` · ${entry.gemStat.h2hHits}/${entry.gemStat.h2hSample} H2H`
            : ""}
        </p>
      </div>

      {entry.slip ? (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
            Max-probability Bet365 builder ({entry.slip.legs.length} leg
            {entry.slip.legs.length === 1 ? "" : "s"})
          </p>
          <BuilderSlipCard slip={entry.slip} liveOdds={liveOdds} />
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-edge bg-background/30 p-4 text-sm text-muted">
          No live Bet365 prices matched for this player&apos;s builder legs yet
          — gem stat above is from tournament + H2H form.
        </p>
      )}
    </article>
  );
}
