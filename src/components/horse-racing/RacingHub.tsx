"use client";

import { useRacingSelection } from "@/components/horse-racing/RacingSelectionProvider";
import type { HorseRace } from "@/lib/horse-racing/types";

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
        {race.runners
          .sort((a, b) => b.overallScore - a.overallScore)
          .map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-edge/60 bg-background/30 p-3"
            >
              <div className="flex items-start justify-between">
                <p className="font-bold">{r.name}</p>
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold tabular text-gold">
                  {Math.round(r.overallScore * 100)}%
                </span>
              </div>
              <p className="text-[11px] text-muted">
                {r.jockey} · {r.trainer}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
                <div>
                  <p className="text-muted">Trip</p>
                  <p className="font-bold tabular">
                    {Math.round(r.distanceFitScore * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted">Course</p>
                  <p className="font-bold tabular">
                    {Math.round(r.courseFitScore * 100)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted">Form</p>
                  <p className="font-bold tabular">
                    {Math.round(r.recentFormScore * 100)}%
                  </p>
                </div>
              </div>
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
              "Distance fit, course form and tipster intelligence."}
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

        {races.length > 0 && (
          <div className="flex flex-col gap-8">
            {races.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}

            {tipsters.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold">
                  <span className="text-gold">★</span> Tipster intelligence
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
        )}
      </div>
    </div>
  );
}
