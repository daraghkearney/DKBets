"use client";

import { useEffect, useState } from "react";
import { sportDataUrl } from "@/lib/sports/paths";
import type { NbaPayload } from "@/lib/nba/client";

export default function NbaHubPage() {
  const [data, setData] = useState<NbaPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(sportDataUrl("nba", "nba", "/hub.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="min-h-screen">
      <div className="border-b border-edge bg-gradient-to-r from-orange-500/10 to-transparent px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold sm:text-3xl">NBA Games Hub</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {data?.sourceLabel ?? "NBA.com Stats"} — scoreboard, season leaders
            and last-20 game prop hit-rates.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <p className="rounded-xl border border-edge bg-surface px-4 py-6 text-sm text-muted">
            NBA data not exported yet — run export after deploy.
          </p>
        )}

        {data && (
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-orange-400">◎</span> Today&apos;s games
              </h2>
              {data.scoreboard.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.scoreboard.map((g) => (
                    <div
                      key={g.gameId}
                      className="rounded-2xl border border-edge bg-surface p-4"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                        {g.status}
                      </p>
                      <p className="mt-2 text-base font-bold">
                        {g.awayAbbr || g.away} @ {g.homeAbbr || g.home}
                      </p>
                      {g.homeScore != null && g.awayScore != null && (
                        <p className="mt-1 text-sm tabular text-orange-300">
                          {g.awayScore} – {g.homeScore}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No games on today&apos;s slate.</p>
              )}
            </section>

            {data.playerProps.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold">
                  <span className="text-orange-400">◈</span> Prop hit-rates ·
                  last 20 games
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.playerProps.slice(0, 8).map((p) => (
                    <div
                      key={p.playerId}
                      className="rounded-2xl border border-edge bg-surface p-4"
                    >
                      <p className="font-bold">{p.name}</p>
                      <p className="text-xs text-muted">{p.team}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.rates
                          .filter((r) => r.sample > 0)
                          .slice(0, 4)
                          .map((r) => (
                            <span
                              key={r.label}
                              className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold"
                            >
                              {r.label}{" "}
                              <span className="text-orange-300 tabular">
                                {Math.round(r.hitRate * 100)}%
                              </span>
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-orange-400">▤</span> Season leaders ·{" "}
                {data.season}
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-edge">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-edge bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">GP</th>
                      <th className="px-4 py-3">PTS</th>
                      <th className="px-4 py-3">REB</th>
                      <th className="px-4 py-3">AST</th>
                      <th className="px-4 py-3">3PM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaders.slice(0, 15).map((p) => (
                      <tr
                        key={p.playerId}
                        className="border-b border-edge/50 hover:bg-surface/50"
                      >
                        <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                        <td className="px-4 py-2.5 text-muted">{p.team}</td>
                        <td className="px-4 py-2.5 tabular">{p.gp}</td>
                        <td className="px-4 py-2.5 tabular text-orange-300">
                          {p.pts.toFixed(1)}
                        </td>
                        <td className="px-4 py-2.5 tabular">{p.reb.toFixed(1)}</td>
                        <td className="px-4 py-2.5 tabular">{p.ast.toFixed(1)}</td>
                        <td className="px-4 py-2.5 tabular">{p.fg3m.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
