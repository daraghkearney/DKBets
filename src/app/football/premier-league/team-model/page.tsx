"use client";

import { useEffect, useState } from "react";
import { useSampleMode } from "@/components/SampleModeProvider";
import type { TeamModelEntry, TeamModelPayload } from "@/lib/builder/team-model";
import TeamModelPanel from "@/components/team/TeamModelPanel";
import PremiumGate from "@/components/subscription/PremiumGate";
import { FEATURES } from "@/lib/subscription/config";

export default function TeamModelPage() {
  const { mode: sampleMode, sampleUrl } = useSampleMode();
  const [teams, setTeams] = useState<TeamModelEntry[]>([]);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      fetch(sampleUrl("/team-model.json"), { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : Promise.reject()
      ),
      fetch(sampleUrl("/builder.json"), { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([modelData, builderData]: [TeamModelPayload, { bet365LiveAvailable?: boolean } | null]) => {
        setTeams(modelData.teams ?? []);
        setLiveAvailable(builderData?.bet365LiveAvailable ?? false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [sampleUrl, sampleMode]);

  const withModels = teams.filter((t) => t.perfectProps.length > 0);
  const withBankers = teams.filter((t) => t.bankerSlip);
  const withExtended = teams.filter((t) => t.extendedSlip);

  return (
    <PremiumGate feature={FEATURES.footballProps}>
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
          ⬡ Team Bet Model
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Team Bet Model</h1>
        <p className="max-w-3xl text-sm text-muted">
          Every team still in the tournament — click to open an unbeaten model
          built from props that have landed in{" "}
          <strong className="text-foreground">every single game</strong> so far:
          team corners, shots, shots on target, fouls, plus player shots, fouls
          won, tackles, and more. Each team gets two builders: a 2-leg banker
          around 6/4 and a 4–5 leg extended acca at higher odds — live Bet365
          prices only.
        </p>
        {!loading && !error && (
          <p className="mt-2 text-xs text-muted">
            {teams.length} teams remaining · {withModels.length} with unbeaten
            props · {withBankers.length} bankers · {withExtended.length}{" "}
            extended
          </p>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">Could not load team model data.</p>
      )}

      {!loading && !error && teams.length === 0 && (
        <p className="rounded-xl border border-edge bg-surface p-6 text-sm text-muted">
          No teams in the competition right now.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {teams.map((entry) => (
          <TeamModelPanel
            key={entry.teamKey}
            entry={entry}
            liveOdds={liveAvailable}
          />
        ))}
      </div>
    </main>
    </PremiumGate>
  );
}
