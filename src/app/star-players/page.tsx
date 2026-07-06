"use client";

import { useEffect, useState } from "react";
import { dataUrl } from "@/lib/basePath";
import type { StarPlayerSpecial, StarPlayersPayload } from "@/lib/builder/star-player";
import StarPlayerCard from "@/components/star/StarPlayerCard";

export default function StarPlayersPage() {
  const [entries, setEntries] = useState<StarPlayerSpecial[]>([]);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(dataUrl("/star-players.json"), { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
      fetch(dataUrl("/builder.json"), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([starData, builderData]: [StarPlayersPayload, { bet365LiveAvailable?: boolean } | null]) => {
        setEntries(starData.entries ?? []);
        setLiveAvailable(builderData?.bet365LiveAvailable ?? false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
          ★ Star Player
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Star Player Specials</h1>
        <p className="max-w-2xl text-sm text-muted">
          One standout player per fixture — their highest-probability stat plus a
          multi-leg same-player Bet365 builder (2/1+ odds) built from stacked
          high-confidence legs.
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

      {!loading && !error && entries.length === 0 && (
        <p className="rounded-xl border border-edge bg-surface p-6 text-sm text-muted">
          No star player specials available yet — check back when lineups and
          live Bet365 prices are loaded.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {entries.map((entry) => (
          <StarPlayerCard
            key={entry.matchId}
            entry={entry}
            liveOdds={liveAvailable}
          />
        ))}
      </div>
    </main>
  );
}
