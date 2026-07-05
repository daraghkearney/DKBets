"use client";

import { useMemo, useState } from "react";
import { BOOKMAKER_MAP } from "@/lib/bookmakers";
import {
  dayLabel,
  dayOffsetOf,
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

const DAYS_SHOWN = 4;

export default function StandoutPicks({ arbs, oddsFormat, onCalculate }: Props) {
  const [day, setDay] = useState(0);
  const now = new Date();

  const byDay = useMemo(() => {
    const groups: ArbOpportunity[][] = Array.from(
      { length: DAYS_SHOWN },
      () => []
    );
    for (const arb of arbs) {
      const offset = dayOffsetOf(arb.kickoff, now);
      if (offset >= 0 && offset < DAYS_SHOWN) groups[offset].push(arb);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arbs]);

  const dayArbs = byDay[day] ?? [];
  const best = dayArbs[0];
  const rest = dayArbs.slice(1, 4);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            <span className="text-gold">★</span> Standout Picks
          </h2>
          <p className="text-xs text-muted">
            Highest guaranteed returns per match day — refreshed live
          </p>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: DAYS_SHOWN }, (_, i) => {
            const d = new Date(now);
            d.setDate(d.getDate() + i);
            const count = byDay[i]?.length ?? 0;
            return (
              <button
                key={i}
                onClick={() => setDay(i)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  day === i
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-edge bg-surface text-muted hover:text-foreground"
                }`}
              >
                {dayLabel(i, d)}
                {count > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent/20 px-1.5 text-[10px] text-accent">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!best ? (
        <div className="rounded-2xl border border-edge bg-surface p-8 text-center text-sm text-muted">
          No guaranteed-profit windows currently open for this day. Odds move
          constantly — this updates automatically the moment one appears.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <BestPickCard
            arb={best}
            oddsFormat={oddsFormat}
            onCalculate={onCalculate}
          />
          <div className="flex flex-col gap-3 lg:col-span-2">
            {rest.length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-edge bg-surface p-6 text-center text-xs text-muted">
                Only one opportunity open for this day right now.
              </div>
            )}
            {rest.map((arb) => (
              <MiniPickCard
                key={arb.id}
                arb={arb}
                oddsFormat={oddsFormat}
                onCalculate={onCalculate}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BestPickCard({
  arb,
  oddsFormat,
  onCalculate,
}: {
  arb: ArbOpportunity;
  oddsFormat: OddsFormat;
  onCalculate: (a: ArbOpportunity) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-surface-2 to-surface p-5 lg:col-span-3">
      <div className="absolute right-0 top-0 rounded-bl-2xl bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-black">
        Best pick of the day
      </div>
      <p className="text-xs text-muted">
        {arb.stage} · {formatKickoff(arb.kickoff)} kick-off
      </p>
      <h3 className="mt-1 text-lg font-bold">
        {arb.homeFlag} {arb.matchLabel} {arb.awayFlag}
      </h3>
      <p className="text-sm text-muted">{arb.marketName}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {arb.legs.map((leg) => {
          const b = BOOKMAKER_MAP[leg.bookmaker];
          return (
            <div
              key={leg.outcomeKey}
              className="flex items-center justify-between rounded-xl border border-edge bg-background/60 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold">{leg.outcomeLabel}</p>
                <p className="text-[11px]" style={{ color: b.color === "#1b1f3b" ? "#4fc3f7" : b.color }}>
                  {b.name}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-lg font-bold text-accent">
                  {formatOdds(leg.odds, oddsFormat)}
                </p>
                <p className="text-[11px] text-muted">
                  {formatPct(leg.share, 1)} of stake
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Guaranteed return
          </p>
          <p className="tabular text-3xl font-black text-accent">
            +{formatPct(arb.profitPct)}
          </p>
        </div>
        <button
          onClick={() => onCalculate(arb)}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Split my stake →
        </button>
      </div>
    </div>
  );
}

function MiniPickCard({
  arb,
  oddsFormat,
  onCalculate,
}: {
  arb: ArbOpportunity;
  oddsFormat: OddsFormat;
  onCalculate: (a: ArbOpportunity) => void;
}) {
  return (
    <button
      onClick={() => onCalculate(arb)}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-edge bg-surface p-4 text-left transition-colors hover:border-accent/50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {arb.homeFlag} {arb.matchLabel} {arb.awayFlag}
        </p>
        <p className="truncate text-xs text-muted">
          {arb.marketName} ·{" "}
          {arb.legs
            .map(
              (l) =>
                `${BOOKMAKER_MAP[l.bookmaker].shortName} ${formatOdds(
                  l.odds,
                  oddsFormat
                )}`
            )
            .join(" / ")}
        </p>
      </div>
      <span className="tabular shrink-0 rounded-lg bg-accent/15 px-2.5 py-1 text-sm font-bold text-accent group-hover:bg-accent/25">
        +{formatPct(arb.profitPct)}
      </span>
    </button>
  );
}
