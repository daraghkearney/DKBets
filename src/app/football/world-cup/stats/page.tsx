"use client";

import { useEffect, useMemo, useState } from "react";
import { StatToggle } from "@/components/stats/StatBlock";
import { useSampleMode } from "@/components/SampleModeProvider";
import type { PlayerTournamentStats } from "@/lib/stats/types";
import PremiumGate from "@/components/subscription/PremiumGate";
import { FEATURES } from "@/lib/subscription/config";

interface Payload {
  byRating: Array<{ id: number; name: string; teamName: string; rating?: number; goals?: number }>;
  byGoals: Array<{ id: number; name: string; teamName: string; goals?: number }>;
  byAssists: Array<{ id: number; name: string; teamName: string; assists?: number }>;
  players: PlayerTournamentStats[];
  sourceLabel?: string;
}

type SortKey = "shots" | "sot" | "fouls" | "foulsWon" | "tackles";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "shots", label: "Sort: shots" },
  { value: "sot", label: "Sort: shots on target" },
  { value: "fouls", label: "Sort: fouls committed" },
  { value: "foulsWon", label: "Sort: fouls won" },
  { value: "tackles", label: "Sort: tackles" },
];

function sortPlayers(
  players: PlayerTournamentStats[],
  sort: SortKey,
  mode: "total" | "per90"
): PlayerTournamentStats[] {
  return [...players].sort((a, b) => {
    const av = mode === "per90" ? a.per90 : a.totals;
    const bv = mode === "per90" ? b.per90 : b.totals;
    let diff = 0;
    switch (sort) {
      case "sot":
        diff = bv.shotsOnTarget - av.shotsOnTarget;
        break;
      case "fouls":
        diff = bv.foulsCommitted - av.foulsCommitted;
        break;
      case "foulsWon":
        diff = bv.foulsWon - av.foulsWon;
        break;
      case "tackles":
        diff = bv.tackles - av.tackles;
        break;
      default:
        diff = bv.shots - av.shots;
    }
    return diff || a.name.localeCompare(b.name);
  });
}

export default function StatsPage() {
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [viewMode, setViewMode] = useState<"total" | "per90">("total");
  const [sort, setSort] = useState<SortKey>("shots");

  useEffect(() => {
    setData(null);
    setError(false);
    fetch(sampleUrl("/stats/players.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [sampleUrl, sampleMode]);

  const sorted = useMemo(
    () => sortPlayers(data?.players ?? [], sort, viewMode),
    [data?.players, sort, viewMode]
  );

  return (
    <PremiumGate feature={FEATURES.footballStats}>
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Player Stats</h1>
          <p className="text-sm text-muted">
            Player numbers for the selected stats sample — fouls, shots, cards
            and more. Data via{" "}
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
        <StatToggle mode={viewMode} setMode={setViewMode} />
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
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-edge bg-surface">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-edge text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3 text-right">Apps</th>
                    <th className="px-4 py-3 text-right">Shots</th>
                    <th className="px-4 py-3 text-right">SoT</th>
                    <th className="px-4 py-3 text-right">Tackles</th>
                    <th className="px-4 py-3 text-right">Fouls</th>
                    <th className="px-4 py-3 text-right">Fouls won</th>
                    <th className="px-4 py-3 text-right">YC</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 40).map((p) => {
                    const t = viewMode === "per90" ? p.per90 : p.totals;
                    return (
                      <tr
                        key={p.playerId}
                        className="border-b border-edge/50 hover:bg-surface-2/40"
                      >
                        <td className="px-4 py-2.5 font-medium">{p.name}</td>
                        <td className="px-4 py-2.5 text-muted">{p.teamName}</td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {viewMode === "per90" ? "—" : t.matches}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">{t.shots}</td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {t.shotsOnTarget}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {t.tackles}
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
    </PremiumGate>
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
