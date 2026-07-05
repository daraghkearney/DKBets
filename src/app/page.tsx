"use client";

import { useMemo, useState } from "react";
import ArbAlerts from "@/components/ArbAlerts";
import ArbTable from "@/components/ArbTable";
import BookmakerFilter from "@/components/BookmakerFilter";
import Guide from "@/components/Guide";
import OddsToolbar from "@/components/OddsToolbar";
import OddsGrid from "@/components/OddsGrid";
import StakeCalculator from "@/components/StakeCalculator";
import StandoutPicks from "@/components/StandoutPicks";
import WatchList from "@/components/WatchList";
import { findArbs, findNearArbs } from "@/lib/arb";
import { BOOKMAKER_IDS } from "@/lib/bookmakers";
import type { Currency, OddsFormat } from "@/lib/format";
import type { ArbOpportunity, BookmakerId } from "@/lib/types";
import { useOdds } from "@/lib/useOdds";

const REFRESH_MS = 10_000;

export default function Home() {
  const { snapshot, error, refreshing, lastUpdated, secondsToRefresh, refresh } =
    useOdds(REFRESH_MS);

  const [oddsFormat, setOddsFormat] = useState<OddsFormat>("decimal");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [enabled, setEnabled] = useState<BookmakerId[]>([...BOOKMAKER_IDS]);
  const [calcArb, setCalcArb] = useState<ArbOpportunity | null>(null);

  const arbs = useMemo(
    () => (snapshot ? findArbs(snapshot.matches, enabled) : []),
    [snapshot, enabled]
  );
  const nearArbs = useMemo(
    () => (snapshot ? findNearArbs(snapshot.matches, enabled) : []),
    [snapshot, enabled]
  );

  const toggleBookmaker = (id: BookmakerId) => {
    setEnabled((prev) => {
      if (prev.includes(id)) {
        // Need at least two bookmakers for an arb to exist
        if (prev.length <= 2) return prev;
        return prev.filter((b) => b !== id);
      }
      return [...prev, id];
    });
  };

  return (
    <div className="min-h-screen">
      <OddsToolbar
        snapshot={snapshot}
        lastUpdated={lastUpdated}
        secondsToRefresh={secondsToRefresh}
        refreshing={refreshing}
        error={error}
        onRefresh={refresh}
        oddsFormat={oddsFormat}
        setOddsFormat={setOddsFormat}
        currency={currency}
        setCurrency={setCurrency}
      />

      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6">
        {!snapshot ? (
          <div className="flex flex-col items-center gap-3 py-24 text-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
            <p className="text-sm">Pulling live World Cup odds…</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <BookmakerFilter enabled={enabled} onToggle={toggleBookmaker} />
              <ArbAlerts arbs={arbs} thresholdPct={1} onSelect={setCalcArb} />
            </div>

            <StandoutPicks
              arbs={arbs}
              oddsFormat={oddsFormat}
              onCalculate={setCalcArb}
            />

            <ArbTable
              arbs={arbs}
              oddsFormat={oddsFormat}
              onCalculate={setCalcArb}
            />

            <WatchList nearArbs={nearArbs} oddsFormat={oddsFormat} />

            <OddsGrid
              matches={snapshot.matches}
              enabled={enabled}
              oddsFormat={oddsFormat}
            />

            <Guide />
          </>
        )}
      </main>

      <StakeCalculator
        arb={calcArb}
        currency={currency}
        oddsFormat={oddsFormat}
        onClose={() => setCalcArb(null)}
      />
    </div>
  );
}
