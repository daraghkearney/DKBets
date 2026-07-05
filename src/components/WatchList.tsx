"use client";

import { BOOKMAKER_MAP } from "@/lib/bookmakers";
import {
  formatKickoff,
  formatOdds,
  formatPct,
  type OddsFormat,
} from "@/lib/format";
import type { ArbOpportunity } from "@/lib/types";

interface Props {
  nearArbs: ArbOpportunity[];
  oddsFormat: OddsFormat;
}

/**
 * Markets closest to crossing into guaranteed profit. The "gap" is how much
 * the combined best prices still favour the bookmakers — one decent price
 * drift and these tip into arbitrage.
 */
export default function WatchList({ nearArbs, oddsFormat }: Props) {
  if (nearArbs.length === 0) return null;

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight">
          Near-Arb Watchlist
        </h2>
        <p className="text-xs text-muted">
          Markets closest to tipping into guaranteed profit — a single price
          move can open the window. Monitored live.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nearArbs.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl border border-edge bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {o.homeFlag} {o.matchLabel} {o.awayFlag}
                </p>
                <p className="text-[11px] text-muted">
                  {o.marketName} · {formatKickoff(o.kickoff)}
                </p>
              </div>
              <span
                className="tabular shrink-0 rounded-lg bg-gold/10 px-2 py-1 text-xs font-bold text-gold"
                title="How far the combined best prices are from guaranteed profit"
              >
                {formatPct(o.impliedTotal - 1)} gap
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {o.legs.map((leg) => {
                const b = BOOKMAKER_MAP[leg.bookmaker];
                return (
                  <span
                    key={leg.outcomeKey}
                    className="tabular inline-flex items-center gap-1 rounded-md border border-edge bg-background/50 px-2 py-1 text-[11px]"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: b?.color }}
                      title={b?.name}
                    />
                    {leg.outcomeLabel}{" "}
                    <strong>{formatOdds(leg.odds, oddsFormat)}</strong>
                    <span className="text-muted">({b?.shortName})</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
