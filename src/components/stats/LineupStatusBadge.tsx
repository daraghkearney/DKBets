"use client";

import { useEffect, useState } from "react";
import {
  effectiveLineupStatus,
  formatLineupCountdown,
  msUntilLineupConfirm,
  type EffectiveLineupStatus,
} from "@/lib/stats/lineup-status";
import type { MatchDetailPayload } from "@/lib/stats/types";

export default function LineupStatusBadge({
  detail,
}: {
  detail: MatchDetailPayload;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const status: EffectiveLineupStatus = effectiveLineupStatus(detail, now);
  const countdownMs = msUntilLineupConfirm(detail.fixture.kickoff, now);

  if (status === "pending") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-muted" />
          Lineup pending
        </span>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Confirmed Lineup
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
        Predicted Lineup
      </span>
      <span className="text-xs text-muted">
        Official lineups in{" "}
        <strong className="tabular text-foreground">
          {formatLineupCountdown(countdownMs)}
        </strong>
      </span>
    </div>
  );
}
