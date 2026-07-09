"use client";

import { useRacingSelection } from "@/components/horse-racing/RacingSelectionProvider";
import type {
  HorseRace,
  RacingFactorKey,
  RacingWinnerReview,
} from "@/lib/horse-racing/types";

const FACTOR_LABELS: Record<RacingFactorKey, string> = {
  market: "Market",
  form: "Form",
  going: "Ground",
  distance: "Trip",
  course: "Course",
  freshness: "Fitness",
  tipster: "Tipsters",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function WinnerReviewPanel({ review }: { review: RacingWinnerReview }) {
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

function RaceCard({ race }: { race: HorseRace }) {
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
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...race.runners]
          .sort((a, b) => b.overallScore - a.overallScore)
          .map((r, i) => (
            <div
              key={r.id}
              className={`rounded-xl border p-3 ${
                i === 0
                  ? "border-gold/50 bg-gold/10"
                  : "border-edge/60 bg-background/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">
                  {i === 0 && <span className="mr-1 text-gold">①</span>}
                  {i === 1 && <span className="mr-1 text-muted">②</span>}
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
              <p className="text-[11px] text-muted">
                {r.jockey} · {r.trainer}
                {r.odds != null && (
                  <span className="ml-1 tabular">· {r.odds.toFixed(1)}</span>
                )}
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
                <div>
                  <p className="text-muted">Market</p>
                  <p className="font-bold tabular">{pct(r.marketScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Ground</p>
                  <p className="font-bold tabular">{pct(r.goingFitScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Trip</p>
                  <p className="font-bold tabular">{pct(r.distanceFitScore)}</p>
                </div>
                <div>
                  <p className="text-muted">Form</p>
                  <p className="font-bold tabular">{pct(r.recentFormScore)}</p>
                </div>
              </div>
              {i === 0 && r.notes.length > 0 && (
                <p className="mt-2 border-t border-edge/60 pt-2 text-[10px] leading-relaxed text-muted">
                  {r.notes.slice(0, 3).join(" · ")}
                </p>
              )}
            </div>
          ))}
      </div>
    </section>
  );
}

export default function RacingHub() {
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
          {calendar?.review && <WinnerReviewPanel review={calendar.review} />}

          {races.map((race) => (
            <RaceCard key={race.id} race={race} />
          ))}

          {races.length > 0 && tipsters.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-gold">★</span> Insider tipster
                intelligence
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {tipsters.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
                  >
                    <p className="text-sm font-bold">{t.tipster}</p>
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
          )}
        </div>
      </div>
    </div>
  );
}
