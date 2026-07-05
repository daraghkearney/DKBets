"use client";

import { useEffect, useState } from "react";
import { dataUrl } from "@/lib/basePath";
import type { BuilderPayload, BuilderSlip } from "@/lib/builder/types";
import BuilderSlipCard from "@/components/builder/BuilderSlipCard";

export default function BuilderPage() {
  const [data, setData] = useState<BuilderPayload | null>(null);
  const [error, setError] = useState(false);
  const [targetId, setTargetId] = useState("2-1");

  useEffect(() => {
    fetch(dataUrl("/builder.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  const selected: BuilderSlip | null =
    data?.builders[targetId] ?? null;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bet Builder</h1>
        <p className="text-sm text-muted">
          Pre-built Bet365-style accumulators from the safest statistical legs —
          shots, fouls, cards, tackles & team markets. Built to hit your target
          odds while maximising landing probability.
        </p>
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
          {data.todaysPick && (
            <section>
              <h2 className="mb-3 text-lg font-bold">
                <span className="text-gold">★</span> Today&apos;s Pick
              </h2>
              <p className="mb-4 text-xs text-muted">
                Highest-confidence slip for today — targeting 88%+ combined
                probability from tournament form and player matchup history.
              </p>
              <BuilderSlipCard slip={data.todaysPick} highlight />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-bold">Build by odds target</h2>
            <p className="mb-4 text-xs text-muted">
              Select your desired combined odds — we fill the builder with the
              safest available legs from upcoming World Cup fixtures (
              {data.legPoolSize} candidates analysed).
            </p>

            <div className="mb-5 flex flex-wrap gap-2">
              {data.targets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTargetId(t.id)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                    targetId === t.id
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-edge bg-surface text-muted hover:border-accent/40 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {selected ? (
              <BuilderSlipCard slip={selected} />
            ) : (
              <p className="rounded-xl border border-edge bg-surface p-6 text-sm text-muted">
                Not enough high-confidence legs to build a slip at this odds
                target right now. Try a higher odds band or check back after
                lineups are confirmed.
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
                Lower odds targets use fewer, safer legs; higher targets add
                more high-hit-rate selections.
              </li>
              <li>
                Player props include shots, SOT, fouls, tackles & cards. Team
                props cover shots, fouls & cards.
              </li>
              <li>
                Prices are estimated from historical hit rates — check Bet365
                for live builder odds before placing.
              </li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
