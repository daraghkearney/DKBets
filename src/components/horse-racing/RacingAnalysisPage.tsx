"use client";

import { useEffect, useState } from "react";
import { sportDataUrl } from "@/lib/sports/paths";
import type { HorseRacingPayload } from "@/lib/horse-racing/types";

export default function RacingAnalysisPage({ meeting }: { meeting: string }) {
  const [data, setData] = useState<HorseRacingPayload | null>(null);

  useEffect(() => {
    fetch(sportDataUrl("horse-racing", meeting, "/hub.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {});
  }, [meeting]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Deep race analysis</h1>
      <p className="mt-2 text-sm text-muted">
        Distance suitability, course history and recent form scoring for every
        runner.
      </p>
      {data?.races.map((race) => (
        <section key={race.id} className="mt-8">
          <h2 className="text-lg font-bold">
            {race.time} · {race.name}
          </h2>
          <div className="mt-3 grid gap-2">
            {race.runners
              .sort((a, b) => b.overallScore - a.overallScore)
              .map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-edge bg-surface px-4 py-3"
                >
                  <div className="flex justify-between">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-sm font-bold text-gold tabular">
                      {Math.round(r.overallScore * 100)}% fit
                    </p>
                  </div>
                  <ul className="mt-1 text-xs text-muted">
                    {r.notes.map((n) => (
                      <li key={n}>· {n}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
