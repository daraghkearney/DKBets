"use client";

import { useEffect, useState } from "react";
import { dataUrl } from "@/lib/basePath";
import type { StarPlayerSpecial, StarPlayersPayload } from "@/lib/builder/star-player";
import StarPlayerCard from "@/components/star/StarPlayerCard";

export default function MatchStarPlayer({ matchId }: { matchId: number }) {
  const [entry, setEntry] = useState<StarPlayerSpecial | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(dataUrl("/star-players.json"), { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(dataUrl("/builder.json"), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([starData, builderData]: [StarPlayersPayload | null, { bet365LiveAvailable?: boolean } | null]) => {
      const hit = starData?.entries?.find((e) => e.matchId === matchId);
      setEntry(hit ?? null);
      setLiveAvailable(builderData?.bet365LiveAvailable ?? false);
    });
  }, [matchId]);

  if (!entry) return null;

  return (
    <section className="mb-8">
      <StarPlayerCard entry={entry} liveOdds={liveAvailable} />
    </section>
  );
}
