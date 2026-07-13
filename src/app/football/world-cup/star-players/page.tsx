"use client";

import { useEffect, useState } from "react";
import { useSampleMode } from "@/components/SampleModeProvider";
import type { StarPlayerFixture, StarPlayersPayload } from "@/lib/builder/star-player";
import StarPlayerFixtureCard from "@/components/star/StarPlayerFixtureCard";
import PremiumGate from "@/components/subscription/PremiumGate";
import { FEATURES } from "@/lib/subscription/config";

export default function StarPlayersPage() {
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [fixtures, setFixtures] = useState<StarPlayerFixture[]>([]);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      fetch(sampleUrl("/star-players.json"), { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
      fetch(sampleUrl("/builder.json"), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([starData, builderData]: [StarPlayersPayload, { bet365LiveAvailable?: boolean } | null]) => {
        const groups =
          starData.fixtures ??
          groupLegacyEntries(starData.entries ?? []);
        setFixtures(groups);
        setLiveAvailable(builderData?.bet365LiveAvailable ?? false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sampleUrl, sampleMode]);

  return (
    <PremiumGate feature={FEATURES.footballProps}>
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
          ★ Star Player
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Star Player Specials</h1>
        <p className="max-w-2xl text-sm text-muted">
          The standout player from each team in every fixture — gem stat plus a
          multi-leg same-player Bet365 builder stacked to evens or 2/1 using as
          many high-probability legs as needed.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">Could not load star player data.</p>
      )}

      {!loading && !error && fixtures.length === 0 && (
        <p className="rounded-xl border border-edge bg-surface p-6 text-sm text-muted">
          No star player specials available yet — check back when lineups are
          loaded.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {fixtures.map((fx) => (
          <StarPlayerFixtureCard
            key={fx.matchId}
            matchId={fx.matchId}
            matchLabel={fx.matchLabel}
            kickoff={fx.kickoff}
            stage={fx.stage}
            stars={fx.stars}
            liveOdds={liveAvailable}
          />
        ))}
      </div>
    </main>
    </PremiumGate>
  );
}

function groupLegacyEntries(
  entries: StarPlayerFixture["stars"]
): StarPlayerFixture[] {
  const map = new Map<number, StarPlayerFixture>();
  for (const e of entries) {
    let fx = map.get(e.matchId);
    if (!fx) {
      fx = {
        matchId: e.matchId,
        matchLabel: e.matchLabel,
        kickoff: e.kickoff,
        stage: e.stage,
        stars: [],
      };
      map.set(e.matchId, fx);
    }
    fx.stars.push(e);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );
}
