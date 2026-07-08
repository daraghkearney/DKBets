"use client";

import { useEffect, useMemo, useState } from "react";
import { useSampleMode } from "@/components/SampleModeProvider";
import {
  composeBuilderView,
  filterBuilderLegs,
  lookupPrecomputedView,
  MARKET_FILTER_OPTIONS,
  maxOddsInScope,
  ODDS_TARGETS,
  type BuilderComposedView,
  type BuilderOptions,
  type BuilderScope,
} from "@/lib/builder/compose";
import {
  composeContextBuilderView,
  lookupContextPrecomputedView,
} from "@/lib/builder/context-compose";
import type { BuilderPayload, BuilderSlip, LegCategory } from "@/lib/builder/types";
import BuilderSlipCard from "@/components/builder/BuilderSlipCard";
import MatchContextPanel from "@/components/builder/MatchContextPanel";
import UnderpricedGemCard from "@/components/builder/UnderpricedGemCard";

export type BuilderMode = "standard" | "context";

const DEFAULT_MAX_LEGS = 8;

export default function BuilderPage() {
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [data, setData] = useState<BuilderPayload | null>(null);
  const [error, setError] = useState(false);
  const [targetId, setTargetId] = useState("2-1");
  const [scope, setScope] = useState<BuilderScope>("today");
  const [matchId, setMatchId] = useState<number | undefined>();
  const [maxLegs, setMaxLegs] = useState(DEFAULT_MAX_LEGS);
  const [categories, setCategories] = useState<LegCategory[]>([]);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("standard");
  const [runtimeComposed, setRuntimeComposed] =
    useState<BuilderComposedView | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    setData(null);
    setError(false);
    fetch(sampleUrl("/builder.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((payload: BuilderPayload) => {
        setData(payload);
        if (payload.fixtures[0]) setMatchId(payload.fixtures[0].id);
      })
      .catch(() => setError(true));
  }, [sampleUrl, sampleMode]);

  const options: BuilderOptions = useMemo(
    () => ({
      scope,
      matchId: scope === "single" ? matchId : undefined,
      maxLegs,
      categories: categories.length ? categories : undefined,
    }),
    [scope, matchId, maxLegs, categories]
  );

  const hasCategoryFilter = categories.length > 0;

  const cachedView = useMemo(() => {
    if (!data || hasCategoryFilter) return null;
    const pre =
      builderMode === "context"
        ? data.contextPrecomputed ?? data.precomputed
        : data.precomputed;
    return builderMode === "context"
      ? lookupContextPrecomputedView(pre, options)
      : lookupPrecomputedView(pre, options);
  }, [data, options, hasCategoryFilter, builderMode]);

  useEffect(() => {
    if (!data || cachedView) {
      setRuntimeComposed(null);
      setComputing(false);
      return;
    }

    setComputing(true);
    const timer = window.setTimeout(() => {
      setRuntimeComposed(
        builderMode === "context"
          ? composeContextBuilderView(data.legs, options)
          : composeBuilderView(data.legs, options)
      );
      setComputing(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [data, options, cachedView, builderMode]);

  const composed = cachedView ?? runtimeComposed;

  const selected: BuilderSlip | null = composed?.builders[targetId] ?? null;
  const scopedLegCount = useMemo(() => {
    if (!data) return 0;
    return filterBuilderLegs(data.legs, options).length;
  }, [data, options]);
  const scopeMaxOdds = useMemo(() => {
    if (!data) return 0;
    const scoped = filterBuilderLegs(data.legs, options);
    return scoped.length ? maxOddsInScope(scoped, maxLegs) : 0;
  }, [data, options, maxLegs]);
  const activeTarget = ODDS_TARGETS.find((t) => t.id === targetId);
  const liveAvailable = data?.bet365LiveAvailable ?? false;
  const apiConfigured = data?.bet365ApiConfigured ?? false;

  const contextReports = useMemo(() => {
    if (!data?.context?.byMatch) return [];
    return data.context.matchIds
      .map((id) => data.context!.byMatch[String(id)])
      .filter(Boolean);
  }, [data]);

  const toggleCategory = (id: LegCategory) => {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#126e51]/40 bg-[#126e51]/10 px-3 py-1 text-xs font-bold text-[#3ecf8e]">
            Bet365 only
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Bet365 Builder</h1>
          <p className="max-w-2xl text-sm text-muted">
            Stats pick the legs — live Bet365 odds price them. We only add
            selections that have a current Bet365 price from odds-api.io; hit
            rates come from tournament form and player matchups (FotMob).
            {!apiConfigured &&
              " Add ODDS_API_IO_KEY in GitHub Actions secrets to enable live odds."}
            {apiConfigured && !liveAvailable &&
              " No live Bet365 prices matched right now — check back closer to kickoff."}
            {liveAvailable &&
              ` ${data?.bet365LiveLegs ?? 0} legs with live Bet365 prices.`}
            {data?.sampleLabel && (
              <>
                {" "}
                Stats sample: <strong className="text-foreground">{data.sampleLabel}</strong>.
              </>
            )}
          </p>
        </div>
        {data && (
          <p className="text-xs text-muted">
            {liveAvailable
              ? `${data.bet365LiveLegs} live Bet365 legs`
              : "0 live legs"}
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
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="mb-2 text-xs font-semibold text-muted">
                  Builder mode
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setBuilderMode("standard")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      builderMode === "standard"
                        ? "border-[#126e51] bg-[#126e51]/15 text-[#3ecf8e]"
                        : "border-edge bg-background text-muted hover:border-[#126e51]/40"
                    }`}
                  >
                    Standard — probability backed
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuilderMode("context")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      builderMode === "context"
                        ? "border-gold/50 bg-gold/15 text-gold"
                        : "border-edge bg-background text-muted hover:border-gold/40"
                    }`}
                  >
                    Add context — research backed
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  {builderMode === "standard"
                    ? "Maximises combined hit-rate from tournament stats and live Bet365 prices."
                    : data?.webResearchConfigured
                      ? "Ranks legs using FotMob duels, formations and team tendencies — plus Tavily web previews when cached at export."
                      : "Ranks legs using matchup duels, career H2H, formation fit and team tendencies — each selection includes supporting research."}
                </p>
              </div>

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

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold text-muted">
                Markets
                {hasCategoryFilter && (
                  <span className="ml-2 font-normal text-[#3ecf8e]">
                    ({categories.length} selected)
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCategories([])}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    !hasCategoryFilter
                      ? "border-[#126e51] bg-[#126e51]/15 text-[#3ecf8e]"
                      : "border-edge bg-background text-muted hover:border-[#126e51]/40"
                  }`}
                >
                  All markets
                </button>
                {MARKET_FILTER_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleCategory(m.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      categories.includes(m.id)
                        ? "border-[#126e51] bg-[#126e51]/15 text-[#3ecf8e]"
                        : "border-edge bg-background text-muted hover:border-[#126e51]/40"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Filter builders to specific event types — odds targets still
                apply, but only legs from selected markets are used.
              </p>
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

          {builderMode === "context" && contextReports.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-gold">◎</span> Match context research
              </h2>
              <p className="mb-4 text-xs text-muted">
                Deep factors behind context-backed builders — career player
                duels, formation matchups, team shot/foul profiles and
                tournament form from FotMob
                {data?.webResearchConfigured
                  ? ", plus tactical previews and H2H notes from web sources (Tavily)."
                  : " data."}
              </p>
              <MatchContextPanel
                reports={contextReports}
                matchId={scope === "single" ? matchId : undefined}
              />
            </section>
          )}

          {composed?.todaysPick && (
            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-gold">★</span>{" "}
                {builderMode === "context" ? "Context Pick" : "Today's Pick"}
              </h2>
              <p className="mb-4 text-xs text-muted">
                {builderMode === "context"
                  ? "Highest-confidence slip where research context strongly supports each leg."
                  : "Highest-confidence Bet365 slip for your scope — built from the strongest combined probability legs in range."}
              </p>
              <BuilderSlipCard
                slip={composed.todaysPick}
                highlight
                liveOdds={liveAvailable}
                showContext={builderMode === "context"}
              />
            </section>
          )}

          {composed?.underpricedGem && (
            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-[#3ecf8e]">◆</span> Underpriced Gem
              </h2>
              <p className="mb-4 text-xs text-muted">
                Standout value where our stats and matchup model sit well above
                Bet365&apos;s live price — player or team markets.
              </p>
              <UnderpricedGemCard
                gem={composed.underpricedGem}
                liveOdds={liveAvailable}
              />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-bold">Build by odds target</h2>
            {computing && (
              <p className="mb-3 text-xs text-muted">Updating builder…</p>
            )}
            <p className="mb-4 text-xs text-muted">
              Each band uses the highest-probability legs that can reach that
              Bet365 odds window from your scope ({scopedLegCount} live Bet365
              legs
              {hasCategoryFilter ? " in selected markets" : " in scope"}).
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
              <BuilderSlipCard
                slip={selected}
                liveOdds={liveAvailable}
                showContext={builderMode === "context"}
              />
            ) : (
              <p className="rounded-xl border border-edge bg-surface p-6 text-sm text-muted">
                {activeTarget &&
                scopeMaxOdds > 0 &&
                scopeMaxOdds < activeTarget.decimalMin ? (
                  <>
                    This scope can only combine to about{" "}
                    <span className="text-foreground">
                      {scopeMaxOdds.toFixed(2)} decimal
                    </span>{" "}
                    ({maxLegs} legs max) — not enough for {activeTarget.label}.
                    Try{" "}
                    <strong className="text-foreground">Multi-game</strong>{" "}
                    scope, increase max legs, or pick a lower odds band.
                  </>
                ) : (
                  <>
                    Not enough live Bet365 legs with strong hit rates to build
                    this slip
                    {hasCategoryFilter
                      ? " for the selected markets"
                      : ""}
                    . Try increasing max legs, widening scope to Multi-game,
                    {hasCategoryFilter
                      ? " adding more market types,"
                      : ""}{" "}
                    or pick a lower odds band.
                  </>
                )}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-edge bg-surface/50 p-4 text-xs text-muted">
            <p className="font-semibold text-foreground">How it works</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Hit rates rank legs by how often the stat lands (World Cup +
                career H2H). Only legs with a live Bet365 price are included.
              </li>
              <li>
                All odds are live Bet365 prices via odds-api.io — we never
                estimate or calibrate prices.
              </li>
              <li>
                Player props: shots, SOT, fouls committed, to be fouled,
                tackles & cards.
              </li>
              <li>
                Each slip includes an <strong className="text-foreground">Open on Bet365</strong>{" "}
                link when odds-api.io provides deep links — cross-game accas load
                pre-filled where supported; same-game Bet Builder opens the match.
              </li>
              <li>Bet365 only — no other bookmakers in this section.</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
