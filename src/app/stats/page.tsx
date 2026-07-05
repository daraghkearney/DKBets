"use client";

import { useEffect, useState } from "react";
import { StatToggle } from "@/components/stats/StatBlock";
import { dataUrl } from "@/lib/basePath";
import type { PlayerTournamentStats } from "@/lib/stats/types";

interface Payload {
  byRating: Array<{ id: number; name: string; teamName: string; rating?: number; goals?: number }>;
  byGoals: Array<{ id: number; name: string; teamName: string; goals?: number }>;
  byAssists: Array<{ id: number; name: string; teamName: string; assists?: number }>;
  players: PlayerTournamentStats[];
  sourceLabel?: string;
}

export default function StatsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<"total" | "per90">("total");
  const [sort, setSort] = useState<"shots" | "fouls" | "sot">("shots");

  useEffect(() => {
    fetch(dataUrl("/stats/players.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const sorted = [...(data?.players ?? [])].sort((a, b) => {
    const av = mode === "per90" ? a.per90 : a.totals;
    const bv = mode === "per90" ? b.per90 : b.totals;
    if (sort === "fouls") return bv.foulsCommitted - av.foulsCommitted;
    if (sort === "sot") return bv.shotsOnTarget - av.shotsOnTarget;
    return bv.shots - av.shots;
  });

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Player Stats</h1>
          <p className="text-sm text-muted">
            World Cup 2026 tournament numbers — fouls, shots, cards and more.
            Data via{" "}
            <a
              href="https://www.fotmob.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              FotMob
            </a>
            .
          </p>
        </div>
        <StatToggle mode={mode} setMode={setMode} />
      </div>

      {data?.sourceLabel && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-center text-xs text-accent">
          {data.sourceLabel}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">Could not load player stats.</p>
      )}

      {!data && !error && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
        </div>
      )}

      {data && (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <LeaderCard title="Top rated" rows={data.byRating.slice(0, 5)} field="rating" />
            <LeaderCard title="Top scorers" rows={data.byGoals.slice(0, 5)} field="goals" />
            <LeaderCard title="Top assists" rows={data.byAssists.slice(0, 5)} field="assists" />
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Full tournament table</h2>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs"
              >
                <option value="shots">Sort: shots</option>
                <option value="sot">Sort: shots on target</option>
                <option value="fouls">Sort: fouls committed</option>
              </select>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-edge bg-surface">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3 text-right">Apps</th>
                    <th className="px-4 py-3 text-right">Shots</th>
                    <th className="px-4 py-3 text-right">SoT</th>
                    <th className="px-4 py-3 text-right">Fouls</th>
                    <th className="px-4 py-3 text-right">Fouled</th>
                    <th className="px-4 py-3 text-right">YC</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 40).map((p) => {
                    const t = mode === "per90" ? p.per90 : p.totals;
                    return (
                      <tr
                        key={p.playerId}
                        className="border-b border-edge/50 hover:bg-surface-2/40"
                      >
                        <td className="px-4 py-2.5 font-medium">{p.name}</td>
                        <td className="px-4 py-2.5 text-muted">{p.teamName}</td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {mode === "per90" ? "—" : t.matches}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">{t.shots}</td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {t.shotsOnTarget}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {t.foulsCommitted}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {t.foulsWon}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {t.yellowCards}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function LeaderCard({
  title,
  rows,
  field,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  field: string;
}) {
  return (
    <div className="rounded-2xl border border-edge bg-surface p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={String(r.id)}
            className="flex items-center justify-between text-sm"
          >
            <span>
              {String(r.name)}{" "}
              <span className="text-muted">({String(r.teamName)})</span>
            </span>
            <span className="tabular font-bold text-accent">
              {String(r[field] ?? "—")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
