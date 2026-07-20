"use client";

import { useEffect, useState } from "react";
import { useSampleMode } from "@/components/SampleModeProvider";
import type { StarPlayerFixture, StarPlayersPayload } from "@/lib/builder/star-player";
import StarPlayerFixtureCard from "@/components/star/StarPlayerFixtureCard";

export default function MatchStarPlayer({ matchId }: { matchId: number }) {
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [fixture, setFixture] = useState<StarPlayerFixture | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(sampleUrl("/star-players.json"), { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(sampleUrl("/builder.json"), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([starData, builderData]: [StarPlayersPayload | null, { bet365LiveAvailable?: boolean } | null]) => {
      const groups = starData?.fixtures ?? [];
      const hit =
        groups.find((f) => f.matchId === matchId) ??
        legacyFixture(starData, matchId);
      setFixture(hit ?? null);
      setLiveAvailable(builderData?.bet365LiveAvailable ?? false);
    });
  }, [matchId, sampleUrl, sampleMode]);

  if (!fixture?.stars.length) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        No star player specials for this match yet.
      </p>
    );
  }

  return (
    <section className="mb-8">
      <StarPlayerFixtureCard
        matchId={fixture.matchId}
        matchLabel={fixture.matchLabel}
        kickoff={fixture.kickoff}
        stage={fixture.stage}
        stars={fixture.stars}
        liveOdds={liveAvailable}
      />
    </section>
  );
}

function legacyFixture(
  data: StarPlayersPayload | null,
  matchId: number
): StarPlayerFixture | null {
  const stars = (data?.entries ?? []).filter((e) => e.matchId === matchId);
  if (!stars.length) return null;
  return {
    matchId,
    matchLabel: stars[0]!.matchLabel,
    kickoff: stars[0]!.kickoff,
    stage: stars[0]!.stage,
    stars,
  };
}
