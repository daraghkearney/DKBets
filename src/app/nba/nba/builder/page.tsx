"use client";

import { useEffect, useMemo, useState } from "react";
import { sportDataUrl } from "@/lib/sports/paths";
import type { NbaPayload, NbaPlayerProps } from "@/lib/nba/client";

export default function NbaBuilderPage() {
  const [data, setData] = useState<NbaPayload | null>(null);

  useEffect(() => {
    fetch(sportDataUrl("nba", "nba", "/hub.json"), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {});
  }, []);

  const ranked = useMemo(() => {
    if (!data?.playerProps.length) return [];
    return [...data.playerProps]
      .map((p) => {
        const best = [...p.rates].sort((a, b) => b.hitRate - a.hitRate)[0];
        return { player: p, best };
      })
      .filter((x) => x.best && x.best.sample >= 5)
      .sort((a, b) => b.best.hitRate - a.best.hitRate)
      .slice(0, 12);
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">NBA Prop Builder</h1>
      <p className="mt-2 text-sm text-muted">
        Highest-confidence player props from last-20 game logs — ranked by hit-rate.
      </p>

      {ranked.length ? (
        <div className="mt-8 flex flex-col gap-3">
          {ranked.map(({ player, best }) => (
            <PropRow key={player.playerId} player={player} best={best} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">
          Awaiting NBA export — run deploy with NBA.com access.
        </p>
      )}
    </div>
  );
}

function PropRow({
  player,
  best,
}: {
  player: NbaPlayerProps;
  best: NbaPlayerProps["rates"][0];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-surface px-4 py-3">
      <div>
        <p className="font-bold">{player.name}</p>
        <p className="text-xs text-muted">{player.team}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-orange-300">{best.label}</p>
        <p className="text-xs text-muted tabular">
          {best.hits}/{best.sample} games ·{" "}
          <span className="font-bold text-foreground">
            {Math.round(best.hitRate * 100)}%
          </span>
        </p>
      </div>
    </div>
  );
}
