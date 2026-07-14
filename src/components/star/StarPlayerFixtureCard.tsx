"use client";

import Link from "next/link";
import { formatKickoff, formatPct } from "@/lib/format";
import type { StarPlayerFixture } from "@/lib/builder/star-player";
import PlayerAvatar from "@/components/stats/PlayerAvatar";
import BuilderSlipCard from "@/components/builder/BuilderSlipCard";

export default function StarPlayerFixtureCard({
  matchLabel,
  matchId,
  kickoff,
  stage,
  stars,
  liveOdds,
}: {
  matchLabel: string;
  matchId: number;
  kickoff: string;
  stage: string;
  stars: StarPlayerFixture["stars"];
  liveOdds?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-gold/35 bg-gradient-to-br from-gold/10 via-surface to-surface p-5">
      <div className="mb-4 border-b border-edge/60 pb-3">
        <h2 className="text-lg font-bold">
          <Link
            href={`/matches/${matchId}/`}
            className="hover:text-[#3ecf8e]"
          >
            {matchLabel}
          </Link>
        </h2>
        <p className="text-xs text-muted">
          {stage} · {formatKickoff(kickoff)} UTC
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {stars.map((star) => (
          <div
            key={star.playerId}
            className="rounded-xl border border-edge/60 bg-background/30 p-4"
          >
            <div className="flex flex-wrap items-start gap-3">
              <PlayerAvatar
                playerId={star.playerId}
                name={star.playerName}
                size={64}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gold">
                  Star Player Special
                </p>
                <h3 className="text-lg font-bold">{star.playerName}</h3>
                <p className="text-sm text-muted">
                  {star.teamName}
                  {star.positionLabel ? ` · ${star.positionLabel}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-gold/25 bg-background/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gold">
                Standout gem stat
              </p>
              <p className="mt-1 font-semibold">{star.gemStat.label}</p>
              <p className="tabular mt-1 text-xl font-black text-[#3ecf8e]">
                {formatPct(star.gemStat.hitRate, 1)}
              </p>
              <p className="text-xs text-muted">
                {star.gemStat.tournamentHits}/{star.gemStat.tournamentSample}{" "}
                tournament games
                {star.gemStat.h2hSample
                  ? ` · ${star.gemStat.h2hHits}/${star.gemStat.h2hSample} H2H`
                  : ""}
              </p>
            </div>

            {star.slip ? (
              <div className="mt-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                  Bet365 builder · {star.slip.combinedFractional} (
                  {star.slip.legs.length} legs)
                </p>
                <BuilderSlipCard slip={star.slip} liveOdds={liveOdds} />
              </div>
            ) : liveOdds === false ? (
              <p className="mt-3 text-xs text-muted">
                Live Bet365 odds are not available — builder legs need real prices.
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted">
                Not enough live Bet365 legs to reach evens+ for this player.
              </p>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
