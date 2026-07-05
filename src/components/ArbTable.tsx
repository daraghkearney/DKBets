"use client";

import { useState } from "react";
import { BOOKMAKER_MAP } from "@/lib/bookmakers";
import {
  formatKickoff,
  formatOdds,
  formatPct,
  type OddsFormat,
} from "@/lib/format";
import type { ArbOpportunity } from "@/lib/types";

interface Props {
  arbs: ArbOpportunity[];
  oddsFormat: OddsFormat;
  onCalculate: (arb: ArbOpportunity) => void;
}

export default function ArbTable({ arbs, oddsFormat, onCalculate }: Props) {
  const [minProfit, setMinProfit] = useState(0);

  const filtered = arbs.filter((a) => a.profitPct * 100 >= minProfit);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            All Live Opportunities
          </h2>
          <p className="text-xs text-muted">
            Every market where backing all outcomes at the best available
            prices locks in profit
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          Min return
          <input
            type="range"
            min={0}
            max={3}
            step={0.25}
            value={minProfit}
            onChange={(e) => setMinProfit(Number(e.target.value))}
            className="w-28 accent-emerald-500"
          />
          <span className="tabular w-10 font-semibold text-foreground">
            {minProfit.toFixed(2)}%
          </span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-muted">
          {arbs.length === 0
            ? "No arbitrage windows open right now — they typically appear and close within minutes as bookmakers re-price. Keep this page open."
            : "No opportunities above your minimum return filter."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-edge bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Legs (best price per outcome)</th>
                <th className="px-4 py-3 text-right">Return</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((arb) => (
                <tr
                  key={arb.id}
                  className="border-b border-edge/60 last:border-0 hover:bg-surface-2/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">
                      {arb.homeFlag} {arb.matchLabel} {arb.awayFlag}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(arb.kickoff).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {formatKickoff(arb.kickoff)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">{arb.marketName}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {arb.legs.map((leg) => {
                        const b = BOOKMAKER_MAP[leg.bookmaker];
                        return (
                          <span
                            key={leg.outcomeKey}
                            className="tabular inline-flex items-center gap-1 rounded-md border border-edge bg-background/50 px-2 py-1 text-xs"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: b.color }}
                              title={b.name}
                            />
                            {leg.outcomeLabel}{" "}
                            <strong>{formatOdds(leg.odds, oddsFormat)}</strong>
                            <span className="text-muted">({b.shortName})</span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="tabular px-4 py-3 text-right font-bold text-accent">
                    +{formatPct(arb.profitPct)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onCalculate(arb)}
                      className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
                    >
                      Calculate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
