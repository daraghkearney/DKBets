"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formatWorldCupFreeEndLabel,
  isWorldCupFreeActive,
  worldCupFreeMsRemaining,
} from "@/lib/marketing/world-cup-promo";
import { withAttribution } from "@/lib/marketing/attribution";

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

export default function WorldCupPromoBanner({ compact = false }: { compact?: boolean }) {
  const [remaining, setRemaining] = useState(() => worldCupFreeMsRemaining());
  const active = isWorldCupFreeActive();
  const endLabel = formatWorldCupFreeEndLabel();

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setRemaining(worldCupFreeMsRemaining());
    }, 1000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  const builderHref = withAttribution("/football/world-cup/builder/");
  const starHref = withAttribution("/football/world-cup/star-players/");

  if (compact) {
    return (
      <div className="border-b border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-center text-xs text-foreground">
        <span className="font-semibold text-emerald-300">World Cup free</span>
        {" · "}
        Football Pro unlocked until {endLabel}
        {" · "}
        <span className="tabular text-muted">{formatCountdown(remaining)} left</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border-b border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-gold/10">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            World Cup launch offer
          </p>
          <p className="mt-0.5 text-sm font-semibold sm:text-base">
            Football Pro is{" "}
            <span className="text-emerald-300">free</span> for semis &amp; final —
            no card needed
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Builders, star players, matchups &amp; stats unlocked until {endLabel}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2 sm:items-end">
          <p className="tabular text-xs font-bold text-gold">
            Ends in {formatCountdown(remaining)}
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
            <Link
              href={builderHref}
              className="rounded-lg bg-accent px-4 py-1.5 text-xs font-bold text-background transition-opacity hover:opacity-90"
            >
              Try Bet365 builder
            </Link>
            <Link
              href={starHref}
              className="rounded-lg border border-edge px-4 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-emerald-500/40 hover:text-foreground"
            >
              Star players
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
