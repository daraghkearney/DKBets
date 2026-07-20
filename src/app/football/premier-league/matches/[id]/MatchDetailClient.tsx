"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MatchHeader } from "@/components/stats/MatchupPanel";
import MatchFeatures from "@/components/fixtures/MatchFeatures";
import PremiumGate from "@/components/subscription/PremiumGate";
import { useSampleMode } from "@/components/SampleModeProvider";
import { FEATURES } from "@/lib/subscription/config";
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
    <PremiumGate feature={FEATURES.footballProps}>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:max-w-5xl sm:px-6 sm:py-8">
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
            <MatchFeatures detail={detail} defaultTab="matchups" />
          </>
        )}
      </main>
    </PremiumGate>
  );
}
