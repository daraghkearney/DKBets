"use client";

import type { OddsSnapshot } from "@/lib/types";
import type { Currency, OddsFormat } from "@/lib/format";

interface Props {
  snapshot: OddsSnapshot | null;
  lastUpdated: Date | null;
  secondsToRefresh: number;
  refreshing: boolean;
  error: boolean;
  onRefresh: () => void;
  oddsFormat: OddsFormat;
  setOddsFormat: (f: OddsFormat) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-edge bg-surface p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
            value === opt.value
              ? "bg-surface-2 text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Odds-page toolbar: live status, refresh, format toggles. */
export default function OddsToolbar({
  snapshot,
  lastUpdated,
  secondsToRefresh,
  refreshing,
  error,
  onRefresh,
  oddsFormat,
  setOddsFormat,
  currency,
  setCurrency,
}: Props) {
  return (
    <div className="border-b border-edge bg-surface/50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-1.5 text-xs">
          <span
            className={`live-dot h-2 w-2 rounded-full ${
              error ? "bg-red-500" : "bg-accent"
            }`}
          />
          <span className="font-medium">
            {error ? "Connection issue" : "Odds live"}
          </span>
          <span className="text-muted">
            {lastUpdated
              ? `updated ${lastUpdated.toLocaleTimeString()}`
              : "loading…"}
          </span>
          <span className="tabular text-muted">
            ·{" "}
            {secondsToRefresh > 0
              ? `next in ${secondsToRefresh}s`
              : "updates every ~15 min"}
          </span>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="ml-1 rounded-md border border-edge px-2 py-0.5 text-muted transition-colors hover:text-foreground disabled:opacity-50"
            title="Refresh now"
          >
            {refreshing ? "…" : "↻"}
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Segmented
            value={oddsFormat}
            onChange={setOddsFormat}
            options={[
              { value: "decimal", label: "1.95" },
              { value: "fractional", label: "19/20" },
            ]}
          />
          <Segmented
            value={currency}
            onChange={setCurrency}
            options={[
              { value: "GBP", label: "£" },
              { value: "EUR", label: "€" },
            ]}
          />
        </div>
      </div>
      {snapshot && snapshot.source === "live" && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-accent/10 px-4 py-1 text-center text-[11px] text-accent sm:px-6">
          <span className="font-semibold">Real odds:</span>
          {snapshot.sources.map((s) => (
            <span
              key={s.id}
              className={s.ok ? "" : "text-red-400"}
              title={s.detail}
            >
              {s.ok ? "●" : "○"} {s.label}
            </span>
          ))}
        </div>
      )}
      {snapshot && snapshot.source === "simulated" && (
        <div className="bg-gold/10 px-4 py-1 text-center text-[11px] text-gold sm:px-6">
          Demo odds — live feeds unreachable. Verify at the bookmaker before
          staking.
        </div>
      )}
    </div>
  );
}
