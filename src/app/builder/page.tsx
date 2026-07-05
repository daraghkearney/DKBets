"use client";

import { useEffect, useMemo, useState } from "react";
import { dataUrl } from "@/lib/basePath";
import {
  composeBuilderView,
  type BuilderOptions,
  type BuilderScope,
} from "@/lib/builder/compose";
import type { BuilderPayload, BuilderSlip } from "@/lib/builder/types";
import BuilderSlipCard from "@/components/builder/BuilderSlipCard";

const DEFAULT_MAX_LEGS = 8;

export default function BuilderPage() {
  const [data, setData] = useState<BuilderPayload | null>(null);
  const [error, setError] = useState(false);
  const [targetId, setTargetId] = useState("2-1");
  const [scope, setScope] = useState<BuilderScope>("today");
  const [matchId, setMatchId] = useState<number | undefined>();
  const [maxLegs, setMaxLegs] = useState(DEFAULT_MAX_LEGS);

  useEffect(() => {
    fetch(dataUrl("/builder.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((payload: BuilderPayload) => {
        setData(payload);
        if (payload.fixtures[0]) setMatchId(payload.fixtures[0].id);
      })
      .catch(() => setError(true));
  }, []);

  const options: BuilderOptions = useMemo(
    () => ({
      scope,
      matchId: scope === "single" ? matchId : undefined,
      maxLegs,
      liveOnly: data?.bet365LiveAvailable ?? false,
    }),
    [scope, matchId, maxLegs, data?.bet365LiveAvailable]
  );

  const composed = useMemo(() => {
    if (!data) return null;
    return composeBuilderView(data.legs, options);
  }, [data, options]);

  const selected: BuilderSlip | null = composed?.builders[targetId] ?? null;
  const liveAvailable = data?.bet365LiveAvailable ?? false;
  const apiConfigured = data?.bet365ApiConfigured ?? false;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#126e51]/40 bg-[#126e51]/10 px-3 py-1 text-xs font-bold text-[#3ecf8e]">
            Bet365 only
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Bet365 Builder</h1>
          <p className="max-w-2xl text-sm text-muted">
            Pre-built Bet365 bet builders from the safest statistical legs —
            shots, fouls, cards, tackles & team markets.
            {liveAvailable
              ? " All slip legs use live Bet365 prices from odds-api.io."
              : apiConfigured
                ? " Live Bet365 prices could not be loaded for these fixtures — showing calibrated estimates."
                : " Odds are calibrated to Bet365's pricing ladder (add ODDS_API_IO_KEY for live prices)."}
          </p>
        </div>
        {data && (
          <p className="text-xs text-muted">
            {liveAvailable
              ? `${data.bet365LiveLegs} live legs`
              : `${data.legs.length} legs`}
            {" · "}
            {data.fixtures.length} fixtures
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400">Could not load bet builder data.</p>
      )}

      {!data && !error && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
        </div>
      )}

      {data && (
        <>
          <section className="rounded-2xl border border-edge bg-surface p-4 sm:p-5">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">
              Builder options
            </h2>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted">Scope</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["single", "One game"],
                      ["today", "Today's games"],
                      ["multi", "Multi-game"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setScope(id)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                        scope === id
                          ? "border-[#126e51] bg-[#126e51]/15 text-[#3ecf8e]"
                          : "border-edge bg-background text-muted hover:border-[#126e51]/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {scope === "single" && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted">Match</p>
                  <select
                    value={matchId ?? ""}
                    onChange={(e) => setMatchId(Number(e.target.value))}
                    className="w-full rounded-xl border border-edge bg-background px-3 py-2 text-sm"
                  >
                    {data.fixtures.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.home} v {f.away}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold text-muted">
                  Max legs: {maxLegs}
                </p>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={maxLegs}
                  onChange={(e) => setMaxLegs(Number(e.target.value))}
                  className="w-full accent-[#126e51]"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted">
                  <span>1</span>
                  <span>15</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted">
              {scope === "single" &&
                "All legs from a single fixture — same-game Bet365 builder."}
              {scope === "today" &&
                "Legs from fixtures kicking off today only."}
              {scope === "multi" &&
                "Cross-fixture builder across all upcoming World Cup games."}
            </p>
          </section>

          {composed?.todaysPick && (
            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-gold">★</span> Today&apos;s Pick
              </h2>
              <p className="mb-4 text-xs text-muted">
                Highest-confidence Bet365 slip for your scope — targeting 88%+
                combined probability from tournament form and player matchup
                history.
              </p>
              <BuilderSlipCard slip={composed.todaysPick} highlight liveOdds={liveAvailable} />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-bold">Build by odds target</h2>
            <p className="mb-4 text-xs text-muted">
              Select your desired combined Bet365 odds — we fill the builder with
              the safest available legs from your scope (
              {filterCount(data.legs, options)} candidates
              {liveAvailable ? " with live Bet365 prices" : ""}).
            </p>

            <div className="mb-5 flex flex-wrap gap-2">
              {data.targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetId(t.id)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                    targetId === t.id
                      ? "border-[#126e51] bg-[#126e51]/15 text-[#3ecf8e]"
                      : "border-edge bg-surface text-muted hover:border-[#126e51]/40 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {selected ? (
              <BuilderSlipCard slip={selected} liveOdds={liveAvailable} />
            ) : (
              <p className="rounded-xl border border-edge bg-surface p-6 text-sm text-muted">
                Not enough high-confidence legs to build a Bet365 slip at this
                odds target for your scope. Try a higher odds band, increase max
                legs, or widen scope to multi-game.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-edge bg-surface/50 p-4 text-xs text-muted">
            <p className="font-semibold text-foreground">How it works</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Each leg is scored from World Cup stats plus career player
                matchups (FotMob).
              </li>
              <li>
                {liveAvailable
                  ? "Leg odds are live Bet365 prices fetched at build time via odds-api.io."
                  : "Leg odds use Bet365's fractional ladder calibrated from historical hit rates when live prices are unavailable."}
              </li>
              <li>
                Player props: shots, SOT, fouls, tackles & cards. Team props:
                shots, fouls & cards.
              </li>
              <li>Bet365 only — no other bookmakers in this section.</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function filterCount(
  legs: BuilderPayload["legs"],
  options: BuilderOptions
): number {
  let pool = legs;
  if (options.liveOnly) {
    pool = pool.filter((l) => l.oddsSource === "bet365_live");
  }
  if (options.scope === "single" && options.matchId != null) {
    return pool.filter((l) => l.matchId === options.matchId).length;
  }
  if (options.scope === "today") {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    return pool.filter((leg) => {
      const k = new Date(leg.kickoff);
      return (
        k.getUTCFullYear() === y && k.getUTCMonth() === m && k.getUTCDate() === d
      );
    }).length;
  }
  return pool.length;
}
