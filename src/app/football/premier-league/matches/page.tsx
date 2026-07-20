"use client";

import { useEffect, useMemo, useState } from "react";
import FixtureDateGroup from "@/components/fixtures/FixtureDateGroup";
import FixtureExpandPanel from "@/components/fixtures/FixtureExpandPanel";
import { groupFixturesByDate } from "@/components/fixtures/groupFixtures";
import PremiumGate from "@/components/subscription/PremiumGate";
import { useSampleMode } from "@/components/SampleModeProvider";
import { formatKickoff, formatPct } from "@/lib/format";
import { FEATURES } from "@/lib/subscription/config";
import type { FixtureSummary, PickStat } from "@/lib/stats/types";

interface Fx extends FixtureSummary {
  likelyProps: PickStat[];
}

type Banker = PickStat & {
  matchLabel: string;
  matchupLabel: string;
  kickoff: string;
};

export default function MatchesPage() {
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [fixtures, setFixtures] = useState<Fx[]>([]);
  const [bankers, setBankers] = useState<Banker[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [bankersOpen, setBankersOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      fetch(sampleUrl("/stats/matches.json"), { cache: "no-store" }).then((r) =>
        r.json()
      ),
      fetch(sampleUrl("/stats/bankers.json"), { cache: "no-store" }).then((r) =>
        r.json()
      ),
    ])
      .then(([m, b]) => {
        setFixtures(m.fixtures ?? []);
        setBankers(b.bankers ?? []);
        setExpandedId(null);
        setDayIndex(0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sampleUrl, sampleMode]);

  const allBuckets = useMemo(() => groupFixturesByDate(fixtures), [fixtures]);
  const multiDay = allBuckets.length > 1;
  const visibleBuckets = multiDay
    ? allBuckets.slice(dayIndex, dayIndex + 1)
    : allBuckets;
  const dayLabel = allBuckets[dayIndex]?.label ?? "";

  function toggleFixture(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <PremiumGate feature={FEATURES.footballProps}>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fixtures</h1>
          <p className="mt-1 text-sm text-muted">
            Tap a match for lineups, positional matchups, props, and star
            players.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400">Could not load match data.</p>
        )}

        {!loading && !error && bankers.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-gold/35 bg-surface">
            <button
              type="button"
              onClick={() => setBankersOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold">
                  <span className="text-gold">★</span> Banker picks
                  <span className="ml-2 font-normal text-muted">
                    {Math.min(bankers.length, 6)} today
                  </span>
                </p>
                <p className="truncate text-[11px] text-muted">
                  ≥85% hit rate · 3+ games in sample
                </p>
              </div>
              <span
                className={`shrink-0 text-muted transition-transform duration-200 ${
                  bankersOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                ▾
              </span>
            </button>
            {bankersOpen && (
              <div className="border-t border-edge/60">
                <div className="flex gap-3 overflow-x-auto px-4 py-3">
                  {bankers.slice(0, 6).map((b) => (
                    <div
                      key={`${b.matchLabel}-${b.label}`}
                      className="min-w-[220px] shrink-0 rounded-xl border border-gold/25 bg-background/40 p-3"
                    >
                      <p className="text-[11px] text-muted">
                        {b.matchLabel} · {formatKickoff(b.kickoff)}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-snug">
                        {b.label}
                      </p>
                      <p className="tabular mt-1 text-sm font-bold text-accent">
                        {formatPct(b.rate)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {!loading && !error && (
          <section className="overflow-hidden rounded-2xl border border-edge bg-surface">
            {multiDay && (
              <div className="flex items-center justify-between gap-3 border-b border-edge px-3 py-3 sm:px-4">
                <button
                  type="button"
                  aria-label="Previous day"
                  disabled={dayIndex <= 0}
                  onClick={() => {
                    setDayIndex((i) => Math.max(0, i - 1));
                    setExpandedId(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                >
                  ‹
                </button>
                <p className="text-center text-sm font-semibold">{dayLabel}</p>
                <button
                  type="button"
                  aria-label="Next day"
                  disabled={dayIndex >= allBuckets.length - 1}
                  onClick={() => {
                    setDayIndex((i) =>
                      Math.min(allBuckets.length - 1, i + 1)
                    );
                    setExpandedId(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            )}

            {visibleBuckets.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No upcoming fixtures found.
              </p>
            ) : (
              visibleBuckets.map((bucket) => (
                <FixtureDateGroup
                  key={bucket.key}
                  bucket={bucket}
                  expandedId={expandedId}
                  onToggle={toggleFixture}
                  renderExpand={(fx) => (
                    <FixtureExpandPanel
                      matchId={fx.id}
                      likelyProps={fx.likelyProps}
                    />
                  )}
                />
              ))
            )}
          </section>
        )}
      </main>
    </PremiumGate>
  );
}
