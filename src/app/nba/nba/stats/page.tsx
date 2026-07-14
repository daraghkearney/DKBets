"use client";

import { useEffect, useState } from "react";
import { sportDataUrl } from "@/lib/sports/paths";
import type { NbaPayload } from "@/lib/nba/client";

export default function NbaStatsPage() {
  const [data, setData] = useState<NbaPayload | null>(null);

  useEffect(() => {
    fetch(sportDataUrl("nba", "nba", "/hub.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">NBA Player Stats</h1>
      <p className="mt-2 text-sm text-muted">
        Per-game leaders from live season data — usage, shooting and matchup
        stats. Prop hit-rates and builder legs coming next.
      </p>

      {data?.leaders.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.leaders.slice(0, 24).map((p) => (
            <div
              key={p.playerId}
              className="rounded-2xl border border-edge bg-surface p-4"
            >
              <p className="font-bold">{p.name}</p>
              <p className="text-xs text-muted">{p.team} · {p.gp} GP</p>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  ["PTS", p.pts],
                  ["REB", p.reb],
                  ["AST", p.ast],
                  ["3PM", p.fg3m],
                ].map(([k, v]) => (
                  <div key={String(k)} className="rounded-lg bg-background/50 py-2">
                    <p className="text-[10px] text-muted">{k}</p>
                    <p className="font-bold tabular text-orange-300">
                      {Number(v).toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Loading or awaiting export…</p>
      )}
    </div>
  );
}
