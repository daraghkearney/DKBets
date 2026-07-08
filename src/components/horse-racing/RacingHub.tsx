"use client";

import { useEffect, useState } from "react";
import { sportDataUrl } from "@/lib/sports/paths";
import type { HorseRacingPayload } from "@/lib/horse-racing/types";

export default function RacingHub({ meeting }: { meeting: string }) {
  const [data, setData] = useState<HorseRacingPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(sportDataUrl("horse-racing", meeting, "/hub.json"), {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, [meeting]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-edge bg-gradient-to-r from-amber-500/10 to-transparent px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {data?.meetingLabel ?? "Horse Racing"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {data?.researchSummary ??
              "Distance fit, course form and tipster intelligence."}
          </p>
          {data?.source === "racing-api" && (
            <span className="mt-2 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Live cards · {data.sourceLabel}
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <p className="rounded-xl border border-edge px-4 py-6 text-sm text-muted">
            Racing data not exported yet.
          </p>
        )}

        {data && (
          <div className="flex flex-col gap-8">
            {data.races.map((race) => (
              <section
                key={race.id}
                className="overflow-hidden rounded-2xl border border-edge bg-surface"
              >
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
            ))}

            {data.tipsters.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-bold">
                  <span className="text-gold">★</span> Tipster intelligence
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.tipsters.map((t) => (
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
