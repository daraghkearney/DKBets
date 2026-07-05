"use client";

import type { StatTotals } from "@/lib/stats/types";

interface Props {
  totals: StatTotals;
  mode: "total" | "per90";
}

const ROWS: Array<{ key: keyof StatTotals; label: string; skipPer90?: boolean }> = [
  { key: "matches", label: "Apps", skipPer90: true },
  { key: "minutes", label: "Mins", skipPer90: true },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "SoT" },
  { key: "foulsCommitted", label: "Fouls" },
  { key: "foulsWon", label: "Fouled" },
  { key: "tackles", label: "Tackles" },
  { key: "yellowCards", label: "Yellows" },
  { key: "redCards", label: "Reds" },
];

export default function StatBlock({ totals, mode }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {ROWS.map(({ key, label, skipPer90 }) => {
        if (mode === "per90" && skipPer90) return null;
        const v = totals[key];
        return (
          <div
            key={key}
            className="rounded-lg border border-edge bg-background/40 px-2 py-1.5 text-center"
          >
            <p className="text-[10px] uppercase tracking-wide text-muted">
              {label}
            </p>
            <p className="tabular text-sm font-bold">{v}</p>
          </div>
        );
      })}
    </div>
  );
}

export function StatToggle({
  mode,
  setMode,
}: {
  mode: "total" | "per90";
  setMode: (m: "total" | "per90") => void;
}) {
  return (
    <div className="flex rounded-lg border border-edge bg-surface p-0.5 text-xs">
      {(
        [
          ["total", "Tournament total"],
          ["per90", "Per 90"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          onClick={() => setMode(v)}
          className={`rounded-md px-2.5 py-1 font-medium ${
            mode === v
              ? "bg-surface-2 text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
