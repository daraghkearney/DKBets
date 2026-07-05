"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOOKMAKERS } from "@/lib/bookmakers";
import {
  dayLabel,
  dayOffsetOf,
  formatKickoff,
  formatOdds,
  formatPct,
  type OddsFormat,
} from "@/lib/format";
import type { BookmakerId, Match, OutcomeOdds } from "@/lib/types";

interface Props {
  matches: Match[];
  enabled: BookmakerId[];
  oddsFormat: OddsFormat;
}

export default function OddsGrid({ matches, enabled, oddsFormat }: Props) {
  const byDay = useMemo(() => {
    const now = new Date();
    const groups = new Map<number, Match[]>();
    for (const m of matches) {
      const offset = dayOffsetOf(m.kickoff, now);
      if (!groups.has(offset)) groups.set(offset, []);
      groups.get(offset)!.push(m);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [matches]);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight">
          Odds Comparison Board
        </h2>
        <p className="text-xs text-muted">
          Best price per outcome is highlighted. Cells flash green when a
          price drifts up, red when it shortens.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {byDay.map(([offset, dayMatches]) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          return (
            <div key={offset}>
              <h3 className="mb-2 text-sm font-semibold text-muted">
                {dayLabel(offset, d)}
              </h3>
              <div className="flex flex-col gap-4">
                {dayMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    enabled={enabled}
                    oddsFormat={oddsFormat}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MatchCard({
  match,
  enabled,
  oddsFormat,
}: {
  match: Match;
  enabled: BookmakerId[];
  oddsFormat: OddsFormat;
}) {
  const [marketId, setMarketId] = useState(match.markets[0]?.id ?? "");
  const market =
    match.markets.find((mk) => mk.id === marketId) ?? match.markets[0];
  // Only show columns for books that actually price this market
  const bookies = BOOKMAKERS.filter(
    (b) =>
      b.available &&
      enabled.includes(b.id) &&
      market?.outcomes.some((oc) => oc.odds[b.id] != null)
  );

  const impliedTotal = market
    ? market.outcomes.reduce((sum, oc) => {
        const best = bestOdds(oc, enabled);
        return best ? sum + 1 / best.odds : sum;
      }, 0)
    : 0;
  const isArb = impliedTotal > 0 && impliedTotal < 1;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-surface ${
        isArb ? "border-accent/60 shadow-[0_0_24px_rgba(34,197,94,0.12)]" : "border-edge"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
        <div>
          <p className="font-bold">
            {match.homeFlag} {match.home}{" "}
            <span className="font-normal text-muted">v</span> {match.away}{" "}
            {match.awayFlag}
          </p>
          <p className="text-[11px] text-muted">
            {match.stage} · {formatKickoff(match.kickoff)}
            {match.venue ? ` · ${match.venue}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isArb && (
            <span className="tabular rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">
              ARB +{formatPct(1 / impliedTotal - 1)}
            </span>
          )}
          <select
            value={market?.id}
            onChange={(e) => setMarketId(e.target.value)}
            className="rounded-lg border border-edge bg-surface-2 px-2 py-1.5 text-xs outline-none"
          >
            {match.markets.map((mk) => (
              <option key={mk.id} value={mk.id}>
                {mk.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {market && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 text-left font-medium">Outcome</th>
                {bookies.map((b) => (
                  <th key={b.id} className="px-2 py-2 text-center font-medium">
                    <span
                      className="inline-block rounded px-2 py-0.5 text-[10px] font-bold"
                      style={{ backgroundColor: b.color, color: b.textColor }}
                      title={b.name}
                    >
                      {bookies.length > 6 ? b.shortName : b.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {market.outcomes.map((oc) => {
                const best = bestOdds(oc, enabled);
                return (
                  <tr key={oc.key} className="border-t border-edge/50">
                    <td className="px-4 py-2.5 font-medium">{oc.label}</td>
                    {bookies.map((b) => {
                      const odds = oc.odds[b.id];
                      const isBest =
                        best != null &&
                        odds != null &&
                        odds === best.odds &&
                        b.id === best.bookie;
                      return (
                        <OddsCell
                          key={b.id}
                          cellId={`${match.id}:${market.id}:${oc.key}:${b.id}`}
                          odds={odds}
                          isBest={isBest}
                          oddsFormat={oddsFormat}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function bestOdds(
  oc: OutcomeOdds,
  enabled: BookmakerId[]
): { odds: number; bookie: BookmakerId } | null {
  let best: { odds: number; bookie: BookmakerId } | null = null;
  for (const id of enabled) {
    const o = oc.odds[id];
    if (o != null && (!best || o > best.odds)) best = { odds: o, bookie: id };
  }
  return best;
}

// Tracks previous prices across renders so cells can flash on movement.
const prevOdds = new Map<string, number>();

function OddsCell({
  cellId,
  odds,
  isBest,
  oddsFormat,
}: {
  cellId: string;
  odds: number | null;
  isBest: boolean;
  oddsFormat: OddsFormat;
}) {
  const prev = prevOdds.get(cellId);
  const direction =
    odds != null && prev != null && odds !== prev
      ? odds > prev
        ? "up"
        : "down"
      : null;

  const lastRendered = useRef(odds);
  useEffect(() => {
    if (odds != null) prevOdds.set(cellId, odds);
    lastRendered.current = odds;
  }, [cellId, odds]);

  return (
    <td className="px-2 py-1.5 text-center">
      {odds == null ? (
        <span className="text-muted">—</span>
      ) : (
        <span
          key={`${odds}`}
          className={`tabular inline-block min-w-[52px] rounded-lg px-2 py-1 font-semibold ${
            direction === "up" ? "odds-up" : direction === "down" ? "odds-down" : ""
          } ${
            isBest
              ? "bg-accent/20 text-accent ring-1 ring-accent/50"
              : "bg-surface-2 text-foreground/90"
          }`}
          title={isBest ? "Best available price" : undefined}
        >
          {formatOdds(odds, oddsFormat)}
          {direction === "up" && <span className="ml-0.5 text-[10px]">▲</span>}
          {direction === "down" && (
            <span className="ml-0.5 text-[10px] text-red-400">▼</span>
          )}
        </span>
      )}
    </td>
  );
}
