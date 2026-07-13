"use client";

import { useEffect, useState } from "react";
import { useRacingSelection } from "@/components/horse-racing/RacingSelectionProvider";
import type {
  HorseRace,
  RacingFactorKey,
  RacingNapPick,
  RacingPerformanceStats,
  RacingWinnerReview,
  TipsterPick,
} from "@/lib/horse-racing/types";
import PremiumGate from "@/components/subscription/PremiumGate";
import { usePremiumAccess } from "@/lib/subscription/access";
import { FEATURES, isSubscriptionEnabled } from "@/lib/subscription/config";

const FACTOR_LABELS: Record<RacingFactorKey, string> = {
  market: "Market",
  rating: "Rating",
  form: "Form",
  going: "Ground",
  distance: "Trip",
  class: "Class",
  trainer: "Trainer",
  jockey: "Jockey",
  course: "Course",
  freshness: "Fitness",
  tipster: "Tipsters",
  draw: "Draw",
  topspeed: "Topspeed",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function WinnerReviewPanel({
  review,
  exportedAt,
}: {
  review: RacingWinnerReview;
  exportedAt?: string;
}) {
  const stale =
    exportedAt &&
    (new Date(exportedAt).getTime() -
      new Date(`${review.date}T20:00:00Z`).getTime()) /
      86_400_000 >
      1.2;

  return (
    <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          Learning from {review.date} results
        </h2>
        <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">
          Model self-review
        </span>
      </div>
      {stale && (
        <p className="mt-2 text-xs text-amber-300/90">
          Latest saved review — a newer day&apos;s learning will appear once
          yesterday&apos;s results and predictions are matched.
        </p>
      )}
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {review.summary}
      </p>
      {review.races.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {review.races.slice(0, 12).map((r) => (
            <div
              key={r.raceId}
              className="rounded-xl border border-edge/60 bg-background/30 px-3 py-2.5"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                {r.time} {r.course}
              </p>
              <p className="text-sm font-semibold">
                {r.winner}
                {r.winnerSp != null && (
                  <span className="ml-1.5 text-xs font-normal text-muted tabular">
                    SP {r.winnerSp.toFixed(1)}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {r.ourRank != null
                  ? r.ourRank === 1
                    ? "✓ We predicted this winner"
                    : `Our rank: #${r.ourRank}${r.fieldSize ? ` of ${r.fieldSize}` : ""}`
                  : "Analysed from history"}
              </p>
              {r.winningFactors.length > 0 && (
                <p className="mt-1 text-[11px] text-sky-300">
                  Found by:{" "}
                  {r.winningFactors
                    .map((f) => FACTOR_LABELS[f] ?? f)
                    .join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ModelWeightsRow({
  weights,
  samples,
}: {
  weights: Record<RacingFactorKey, number>;
  samples: number;
}) {
  const sorted = (Object.entries(weights) as [RacingFactorKey, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
      <span className="font-bold uppercase tracking-widest text-muted">
        Learned weights{samples ? ` · ${samples} races` : ""}:
      </span>
      {sorted.map(([key, w]) => (
        <span
          key={key}
          className="rounded-full border border-edge bg-surface px-2 py-0.5 tabular text-muted"
        >
          {FACTOR_LABELS[key]} {pct(w)}
        </span>
      ))}
    </div>
  );
}

function PerformancePanel({ stats }: { stats: RacingPerformanceStats }) {
  if (!stats.totalPicks) return null;
  return (
    <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          Model track record ({stats.windowDays} days)
        </h2>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
          Performance ledger
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-edge/60 bg-background/30 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Win hit rate
          </p>
          <p className="text-xl font-bold tabular text-emerald-300">
            {pct(stats.winRate)}
          </p>
          <p className="text-[11px] text-muted">
            {stats.wins}/{stats.totalPicks} #1 picks
          </p>
        </div>
        <div className="rounded-xl border border-edge/60 bg-background/30 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Top-3 rate
          </p>
          <p className="text-xl font-bold tabular">{pct(stats.top3Rate)}</p>
          <p className="text-[11px] text-muted">
            {stats.top3}/{stats.totalPicks} in frame
          </p>
        </div>
        <div className="rounded-xl border border-edge/60 bg-background/30 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Flat £1 ROI
          </p>
          <p
            className={`text-xl font-bold tabular ${stats.roiFlatStake >= 0 ? "text-emerald-300" : "text-red-300"}`}
          >
            {stats.roiFlatStake >= 0 ? "+" : ""}
            {pct(stats.roiFlatStake)}
          </p>
          <p className="text-[11px] text-muted">At SP on every #1</p>
        </div>
        {stats.napPicks > 0 && (
          <div className="rounded-xl border border-gold/40 bg-gold/5 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gold">
              Nap strike rate
            </p>
            <p className="text-xl font-bold tabular text-gold">
              {pct(stats.napWinRate)}
            </p>
            <p className="text-[11px] text-muted">
              {stats.napWins}/{stats.napPicks} value naps
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function NapPicksPanel({ naps }: { naps: RacingNapPick[] }) {
  if (!naps.length) return null;
  return (
    <section className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          <span className="text-gold">★</span> Today&apos;s value naps
        </h2>
        <span className="text-xs text-muted">
          Selective picks — model edge vs market, strict gates
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {naps.map((n) => (
          <div
            key={`${n.raceId}-${n.runnerId}`}
            className={`rounded-xl border px-4 py-3 ${
              n.confidence === "high"
                ? "border-gold/50 bg-gold/10"
                : "border-edge/60 bg-background/30"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              {n.time} {n.course}
            </p>
            <p className="text-sm font-bold">
              {n.horse}
              {n.odds != null && (
                <span className="ml-2 font-normal text-muted tabular">
                  {n.odds.toFixed(1)}
                </span>
              )}
            </p>
            <p className="mt-1 text-[11px] text-gold tabular">
              Edge {n.edge.toFixed(2)}× · Model {pct(n.modelProb)} vs market{" "}
              {pct(n.impliedProb)}
            </p>
            {n.rationale.length > 0 && (
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {n.rationale.join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EachWayGemBanner({
  gem,
}: {
  gem: NonNullable<HorseRace["eachWayGem"]>;
}) {
  return (
    <div className="border-b border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
        💎 Each-way gem
      </p>
      <p className="mt-0.5 text-sm font-bold">
        {gem.name}
        {gem.odds != null && (
          <span className="ml-2 font-normal text-muted tabular">
            {gem.odds.toFixed(1)}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{gem.rationale}</p>
    </div>
  );
}

function HotTipBanner({ pick }: { pick: TipsterPick }) {
  return (
    <div className="border-b border-red-500/30 bg-gradient-to-r from-red-500/15 via-amber-500/10 to-transparent px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">
        🔥 Red-hot tip
      </p>
      <p className="mt-0.5 text-sm font-bold">
        {pick.matchedRunner ?? pick.horse}
        <span className="ml-2 font-normal text-muted">
          — {pick.tipster}
          {pick.platform && pick.platform !== "web" && (
            <span className="ml-1 text-[11px]">(via {pick.platform})</span>
          )}
        </span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {pick.trackRecord} · {pick.rationale.slice(0, 180)}
      </p>
    </div>
  );
}

function RaceCard({
  race,
  hotPicks,
  showPremium,
}: {
  race: HorseRace;
  hotPicks: TipsterPick[];
  showPremium: boolean;
}) {
  const runners = [...race.runners].sort((a, b) => b.overallScore - a.overallScore);
  const visibleRunners = showPremium ? runners : runners.slice(0, 1);
  return (
    <section className="overflow-hidden rounded-2xl border border-edge bg-surface">
      <div className="border-b border-edge px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
          {race.time} · {race.course}
        </p>
        <h2 className="text-lg font-bold">{race.name}</h2>
        <p className="text-xs text-muted">
          {race.distance} · {race.going} · {race.raceClass}
        </p>
        {race.verdict && (
          <p className="mt-2 rounded-lg border border-edge/60 bg-background/40 px-3 py-2 text-xs leading-relaxed text-muted">
            <span className="font-bold uppercase tracking-wide text-gold/80">
              Verdict:{" "}
            </span>
            {race.verdict}
          </p>
        )}
      </div>
      {hotPicks.map((p) => (
        <HotTipBanner key={p.id} pick={p} />
      ))}
      {race.eachWayGem && <EachWayGemBanner gem={race.eachWayGem} />}
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleRunners.map((r, i) => {
            const isEwGem = race.eachWayGem?.runnerId === r.id;
            return (
            <div
              key={r.id}
              className={`rounded-xl border p-3 ${
                i === 0
                  ? "border-gold/50 bg-gold/10"
                  : isEwGem
                    ? "border-emerald-500/45 bg-emerald-500/10"
                    : "border-edge/60 bg-background/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">
                  {i === 0 && <span className="mr-1 text-gold">①</span>}
                  {i === 1 && !isEwGem && <span className="mr-1 text-muted">②</span>}
                  {isEwGem && <span className="mr-1 text-emerald-300">💎</span>}
                  {r.name}
                  {r.tipsterScore > 0.6 && (
                    <span
                      className="ml-1 text-amber-300"
                      title="Backed by tipster intelligence"
                    >
                      ★
                    </span>
                  )}
                </p>
                <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold tabular text-gold">
                  {pct(r.overallScore)}
                </span>
              </div>
              {showPremium && r.modelEdge != null && r.modelEdge >= 1.12 && (
                <p className="mt-1 text-[10px] font-bold text-emerald-300 tabular">
                  Value edge {r.modelEdge.toFixed(2)}× vs SP
                  {r.winProbability != null &&
                    ` · ${pct(r.winProbability)} win prob`}
                </p>
              )}
              <p className="text-[11px] text-muted">
                {r.jockey} · {r.trainer}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
                {r.odds != null && (
                  <span className="tabular font-semibold text-foreground/90">
                    {r.odds.toFixed(1)}
                  </span>
                )}
                {r.officialRating != null && (
                  <span className="tabular">OR {r.officialRating}</span>
                )}
                {r.rpr != null && <span className="tabular">RPR {r.rpr}</span>}
                {r.topspeed != null && (
                  <span className="tabular">TS {r.topspeed}</span>
                )}
                {r.draw && <span className="tabular">Dr {r.draw}</span>}
                {(r.tipCount ?? 0) > 0 && (
                  <span
                    className="font-semibold text-amber-300"
                    title={(r.tippedBy ?? []).join(", ")}
                  >
                    ★ {r.tipCount} tip{r.tipCount === 1 ? "" : "s"}
                  </span>
                )}
              </p>
              {(r.tipCount ?? 0) > 0 && (r.tippedBy?.length ?? 0) > 0 && (
                <p className="mt-1 text-[10px] leading-relaxed text-amber-200/90">
                  Tipped by {(r.tippedBy ?? []).slice(0, 3).join(", ")}
                </p>
              )}
              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
                {showPremium ? (
                  <>
                <div>
                  <p className="text-muted">Market</p>
                  <p className="font-bold tabular">{pct(r.marketScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Rating</p>
                  <p className="font-bold tabular">{pct(r.ratingScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Topspeed</p>
                  <p className="font-bold tabular">{pct(r.topspeedScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Draw</p>
                  <p className="font-bold tabular">{pct(r.drawScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Ground</p>
                  <p className="font-bold tabular">{pct(r.goingFitScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Form</p>
                  <p className="font-bold tabular">{pct(r.recentFormScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Trainer</p>
                  <p className="font-bold tabular">{pct(r.trainerScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Tipster</p>
                  <p className="font-bold tabular">{pct(r.tipsterScore)}</p>
                </div>
                  </>
                ) : (
                  <p className="col-span-4 text-[10px] text-muted">
                    Pro — full 13-factor breakdown for every runner
                  </p>
                )}
              </div>
              {r.spotlight && (
                <p className="mt-2 border-t border-edge/60 pt-2 text-[10px] italic leading-relaxed text-muted">
                  {r.spotlight}
                </p>
              )}
              {r.notes.length > 0 && (
                <p
                  className={`${r.spotlight ? "mt-1" : "mt-2 border-t border-edge/60 pt-2"} text-[10px] leading-relaxed text-muted`}
                >
                  {r.notes.slice(0, 3).join(" · ")}
                </p>
              )}
            </div>
            );
          })}
      </div>
      {!showPremium && runners.length > 1 && (
        <div className="border-t border-edge px-4 py-3">
          <PremiumGate feature={FEATURES.racingIntel} compact />
        </div>
      )}
    </section>
  );
}

export default function RacingHub() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isSubscriptionEnabled()) {
    return <RacingHubBody showPremium={true} />;
  }

  if (!mounted) {
    return <RacingHubBody showPremium={false} />;
  }

  return <RacingHubWithAccess />;
}

function RacingHubWithAccess() {
  const { isPremium } = usePremiumAccess(FEATURES.racingIntel);
  const showPremium = !isSubscriptionEnabled() || isPremium;
  return <RacingHubBody showPremium={showPremium} />;
}

function RacingHubBody({ showPremium }: { showPremium: boolean }) {
  const {
    calendar,
    loading,
    error,
    selectedMeeting,
    races,
    tipsters,
  } = useRacingSelection();

  return (
    <div className="min-h-screen">
      <div className="border-b border-edge bg-gradient-to-r from-amber-500/10 to-transparent px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {selectedMeeting?.name ?? "Horse Racing"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {calendar?.sourceLabel ??
              "Market, ground, trip, course, form and insider tipster intelligence — weighted by results learned from every completed race day."}
          </p>
          {calendar?.source === "racing-api" && (
            <span className="mt-2 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Live cards · {calendar.sourceLabel}
            </span>
          )}
          {(calendar?.source === "racing-api+hrnet" ||
            calendar?.source === "hrnet") && (
            <span className="mt-2 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Live cards · {calendar.sourceLabel}
            </span>
          )}
          {calendar?.source !== "racing-api" && calendar?.racingApiDebug && (
            <p className="mt-2 text-[11px] text-amber-300">
              Demo cards shown — API: {calendar.racingApiDebug.slice(0, 120)}
            </p>
          )}
          {calendar?.model && (
            <div className="mt-3">
              <ModelWeightsRow
                weights={calendar.model.weights}
                samples={calendar.model.samples}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <p className="rounded-xl border border-edge px-4 py-6 text-sm text-muted">
            Racing calendar not exported yet.
          </p>
        )}

        {loading && (
          <p className="text-sm text-muted">Loading racecards…</p>
        )}

        {!loading && !selectedMeeting && (
          <p className="text-sm text-muted">
            Select a day and meeting above to view racecards.
          </p>
        )}

        <div className="flex flex-col gap-8">
          {calendar?.performance && (
            <PremiumGate feature={FEATURES.racingIntel}>
              <PerformancePanel stats={calendar.performance} />
            </PremiumGate>
          )}

          {calendar?.naps && calendar.naps.length > 0 && (
            <PremiumGate feature={FEATURES.racingIntel}>
              <NapPicksPanel naps={calendar.naps} />
            </PremiumGate>
          )}

          {calendar?.review && (
            <PremiumGate feature={FEATURES.racingAnalysis}>
            <WinnerReviewPanel
              review={calendar.review}
              exportedAt={calendar.exportedAt}
            />
            </PremiumGate>
          )}

          {races.map((race) => (
            <RaceCard
              key={race.id}
              race={race}
              showPremium={showPremium}
              hotPicks={tipsters.filter(
                (t) => t.hot && t.raceId === race.id
              )}
            />
          ))}

          {races.length > 0 && tipsters.length > 0 && (
            <PremiumGate feature={FEATURES.racingIntel}>
            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-gold">★</span> Insider tipster
                intelligence
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {tipsters.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-4 ${
                      t.hot
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-amber-500/30 bg-amber-500/5"
                    }`}
                  >
                    <p className="text-sm font-bold">
                      {t.hot && <span className="mr-1">🔥</span>}
                      {t.tipster}
                    </p>
                    <p className="text-xs text-muted">{t.trackRecord}</p>
                    <p className="mt-2 text-sm font-semibold">{t.horse}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {t.rationale}
                    </p>
                    {t.sourceUrl && (
                      <a
                        href={t.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-[11px] text-gold underline"
                      >
                        Source →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
            </PremiumGate>
          )}
        </div>
      </div>
    </div>
  );
}
