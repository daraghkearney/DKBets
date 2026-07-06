"use client";

import { useState } from "react";
import { formatKickoff, formatPct } from "@/lib/format";
import type { TeamModelEntry } from "@/lib/builder/team-model";
import BuilderSlipCard from "@/components/builder/BuilderSlipCard";

export default function TeamModelPanel({
  entry,
  liveOdds,
}: {
  entry: TeamModelEntry;
  liveOdds?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const unbeaten = entry.perfectProps.length;
  const hasSlip = Boolean(entry.slip);

  return (
    <article className="rounded-2xl border border-edge bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-background/40"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{entry.teamName}</h2>
          <p className="text-xs text-muted">
            {entry.gamesPlayed} tournament games
            {entry.nextOpponent
              ? ` · Next: ${entry.nextOpponent}`
              : ""}
            {entry.nextKickoff
              ? ` · ${formatKickoff(entry.nextKickoff)} UTC`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unbeaten > 0 && (
            <span className="rounded-full border border-[#3ecf8e]/40 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-xs font-bold text-[#3ecf8e]">
              {unbeaten} unbeaten
            </span>
          )}
          {hasSlip && (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold">
              {entry.slip!.combinedFractional}
            </span>
          )}
          <span className="text-muted">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-edge px-5 py-4">
          {entry.perfectProps.length === 0 ? (
            <p className="text-sm text-muted">
              No props have landed in every game yet (need at least{" "}
              {2} completed matches).
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">
                Props that have hit in{" "}
                <strong className="text-foreground">100%</strong> of games so
                far — stacked into a Bet365 builder for{" "}
                {entry.nextMatchLabel ?? "the next fixture"} using live odds
                only.
              </p>

              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                {entry.perfectProps.map((prop) => (
                  <div
                    key={`${prop.kind}-${prop.label}`}
                    className="rounded-lg border border-edge/80 bg-background/30 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{prop.label}</p>
                      <span className="shrink-0 rounded bg-[#3ecf8e]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#3ecf8e]">
                        {prop.hits}/{prop.sample}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                      {prop.kind === "team" ? "Team stat" : "Player stat"}
                      {prop.teamMarket || prop.playerName
                        ? ` · ${prop.teamMarket ?? `${prop.playerName} live`}`
                        : ""}
                    </p>
                  </div>
                ))}
              </div>

              {entry.history.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                    Team game log
                  </p>
                  <table className="w-full min-w-[28rem] text-left text-xs">
                    <thead>
                      <tr className="border-b border-edge text-muted">
                        <th className="py-1 pr-3 font-medium">Opponent</th>
                        <th className="py-1 pr-3 font-medium">Shots</th>
                        <th className="py-1 pr-3 font-medium">SoT</th>
                        <th className="py-1 pr-3 font-medium">Corners</th>
                        <th className="py-1 font-medium">Fouls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.history.map((g) => (
                        <tr
                          key={g.matchId}
                          className="border-b border-edge/50"
                        >
                          <td className="py-1.5 pr-3">{g.opponent}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{g.shots}</td>
                          <td className="py-1.5 pr-3 tabular-nums">
                            {g.shotsOnTarget}
                          </td>
                          <td className="py-1.5 pr-3 tabular-nums">
                            {g.corners}
                          </td>
                          <td className="py-1.5 tabular-nums">{g.fouls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {entry.slip ? (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                    Unbeaten model · {entry.pricedLegs} live legs priced ·{" "}
                    {formatPct(entry.slip.combinedProbability, 1)} combined hit
                    rate
                  </p>
                  <BuilderSlipCard slip={entry.slip} liveOdds={liveOdds} />
                </div>
              ) : liveOdds === false ? (
                <p className="text-xs text-muted">
                  Live Bet365 odds are not available — model legs need real
                  prices from odds-api.io.
                </p>
              ) : entry.pricedLegs === 0 ? (
                <p className="text-xs text-muted">
                  Unbeaten stats found, but no live Bet365 prices for the next
                  fixture yet.
                </p>
              ) : (
                <p className="text-xs text-muted">
                  Not enough priced unbeaten legs to reach evens+ for the next
                  fixture.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}
