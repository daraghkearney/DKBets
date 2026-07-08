"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatKickoff, formatPct } from "@/lib/format";
import { useSampleMode } from "@/components/SampleModeProvider";
import type { FixtureSummary, PickStat } from "@/lib/stats/types";

interface Fx extends FixtureSummary {
  likelyProps: PickStat[];
}

export default function MatchesPage() {
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [fixtures, setFixtures] = useState<Fx[]>([]);
  const [bankers, setBankers] = useState<
    Array<PickStat & { matchLabel: string; matchupLabel: string; kickoff: string }>
  >([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

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
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sampleUrl, sampleMode]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Matchups</h1>
        <p className="text-sm text-muted">
          Upcoming World Cup fixtures with positional 1v1 matchups, likely
          player props, and banker picks from historical hit rates.
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

      {bankers.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">
            <span className="text-gold">★</span> Banker Picks of the Day
          </h2>
          <p className="mb-4 text-xs text-muted">
            Highest-confidence player props today (≥85% hit rate, 3+ games in
            sample). Based on tournament + head-to-head history — not a
            guarantee.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {bankers.slice(0, 6).map((b) => (
              <div
                key={`${b.matchLabel}-${b.label}`}
                className="rounded-2xl border border-gold/40 bg-gradient-to-br from-surface-2 to-surface p-4"
              >
                <p className="text-[11px] text-muted">
                  {b.matchLabel} · {formatKickoff(b.kickoff)}
                </p>
                <p className="text-xs text-muted">{b.matchupLabel}</p>
                <p className="mt-2 font-semibold">{b.label}</p>
                <p className="tabular mt-1 text-lg font-black text-accent">
                  {formatPct(b.rate)} hit rate ({b.h2hHits + b.tournamentHits}/
                  {b.sample})
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-bold">Upcoming fixtures</h2>
        <div className="flex flex-col gap-4">
          {fixtures.map((fx) => (
            <Link
              key={fx.id}
              href={`/matches/${fx.id}`}
              className="group rounded-2xl border border-edge bg-surface p-5 transition-colors hover:border-accent/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold group-hover:text-accent">
                    {fx.home} v {fx.away}
                  </p>
                  <p className="text-xs text-muted">
                    {fx.stage} · {formatKickoff(fx.kickoff)} UTC
                  </p>
                </div>
                <span className="rounded-lg bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                  View matchups →
                </span>
              </div>
              {fx.likelyProps.length > 0 && (
                <div className="mt-4 border-t border-edge pt-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                    Likely to happen
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {fx.likelyProps.slice(0, 4).map((p) => (
                      <span
                        key={p.label}
                        className="rounded-full border border-edge bg-background/50 px-2.5 py-1 text-[11px]"
                      >
                        {p.label}{" "}
                        <strong className="text-accent">
                          {formatPct(p.rate)}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Link>
          ))}
          {!loading && fixtures.length === 0 && (
            <p className="text-sm text-muted">No upcoming fixtures found.</p>
          )}
        </div>
      </section>
    </main>
  );
}
