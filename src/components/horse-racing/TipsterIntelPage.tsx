"use client";

import { useEffect, useState } from "react";
import { sportDataUrl } from "@/lib/sports/paths";
import type { HorseRacingPayload } from "@/lib/horse-racing/types";

export default function TipsterIntelPage({ meeting }: { meeting: string }) {
  const [data, setData] = useState<HorseRacingPayload | null>(null);

  useEffect(() => {
    fetch(sportDataUrl("horse-racing", meeting, "/hub.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {});
  }, [meeting]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Tipster intelligence</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Web-sourced consensus from proven racing publications and analysts —
        Racing Post, Timeform, At The Races and festival specialists.
      </p>
      {data?.tipsters.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {data.tipsters.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"
            >
              <div className="flex justify-between">
                <p className="font-bold">{t.tipster}</p>
                <span className="text-sm font-bold text-gold tabular">
                  {Math.round(t.confidence * 100)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{t.trackRecord}</p>
              <p className="mt-3 text-lg font-semibold">{t.horse}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {t.rationale}
              </p>
              {t.sourceUrl && (
                <a
                  href={t.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs text-gold underline"
                >
                  Read source →
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">
          No tipster data yet — run export with Tavily web research enabled.
        </p>
      )}
    </div>
  );
}
