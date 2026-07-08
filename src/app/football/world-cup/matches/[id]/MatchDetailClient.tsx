"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import MatchupPanel, { MatchHeader } from "@/components/stats/MatchupPanel";
import MatchStarPlayer from "@/components/star/MatchStarPlayer";
import { useSampleMode } from "@/components/SampleModeProvider";
import type { MatchDetailPayload } from "@/lib/stats/types";

export default function MatchDetailClient() {
  const params = useParams();
  const id = params?.id as string;
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [detail, setDetail] = useState<MatchDetailPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setDetail(null);
    setError(false);
    fetch(sampleUrl(`/stats/match/${id}.json`), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDetail)
      .catch(() => setError(true));
  }, [id, sampleUrl, sampleMode]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {error && (
        <p className="text-sm text-red-400">Could not load this match.</p>
      )}
      {!detail && !error && (
        <div className="flex justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
        </div>
      )}
      {detail && (
        <>
          <MatchHeader detail={detail} />
          <MatchStarPlayer matchId={detail.fixture.id} />
          <MatchupPanel detail={detail} />
        </>
      )}
    </main>
  );
}
