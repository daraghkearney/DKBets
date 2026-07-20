"use client";

import { useEffect, useState } from "react";
import { useSampleMode } from "@/components/SampleModeProvider";
import MatchFeatures from "@/components/fixtures/MatchFeatures";
import type { MatchDetailPayload, PickStat } from "@/lib/stats/types";

export default function FixtureExpandPanel({
  matchId,
  likelyProps = [],
}: {
  matchId: number;
  likelyProps?: PickStat[];
}) {
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [detail, setDetail] = useState<MatchDetailPayload | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setDetail(null);
    fetch(sampleUrl(`/stats/match/${matchId}.json`), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: MatchDetailPayload) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, sampleUrl, sampleMode]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-edge border-t-accent" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <p className="py-4 text-center text-sm text-red-400">
        Could not load this match.
      </p>
    );
  }

  return (
    <div className="fixture-expand-panel animate-[toast-in_0.25s_ease-out]">
      <MatchFeatures
        detail={detail}
        likelyProps={likelyProps}
        fullMatchHref={`/football/premier-league/matches/${matchId}/`}
      />
    </div>
  );
}
