"use client";

import { useState } from "react";
import Link from "next/link";
import MatchupPanel from "@/components/stats/MatchupPanel";
import MatchStarPlayer from "@/components/star/MatchStarPlayer";
import { formatPct } from "@/lib/format";
import type { MatchDetailPayload, PickStat } from "@/lib/stats/types";

export type MatchFeatureTab = "overview" | "lineups" | "matchups" | "stars";

const TABS: { id: MatchFeatureTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "lineups", label: "Lineups" },
  { id: "matchups", label: "Matchups" },
  { id: "stars", label: "Stars" },
];

export default function MatchFeatures({
  detail,
  likelyProps = [],
  fullMatchHref,
  defaultTab = "overview",
}: {
  detail: MatchDetailPayload;
  likelyProps?: PickStat[];
  fullMatchHref?: string;
  defaultTab?: MatchFeatureTab;
}) {
  const [tab, setTab] = useState<MatchFeatureTab>(defaultTab);
  const positionalCount = detail.matchups.filter(
    (m) => m.kind === "positional"
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex gap-1 overflow-x-auto border-b border-edge pb-px"
        role="tablist"
        aria-label="Match features"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 ${
                active
                  ? "text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="min-h-[120px]">
        {tab === "overview" && (
          <OverviewPanel
            detail={detail}
            likelyProps={likelyProps}
            positionalCount={positionalCount}
            fullMatchHref={fullMatchHref}
            onOpenTab={setTab}
          />
        )}
        {tab === "lineups" && (
          <MatchupPanel detail={detail} sections="lineups" />
        )}
        {tab === "matchups" && (
          <MatchupPanel detail={detail} sections="all" />
        )}
        {tab === "stars" && (
          <MatchStarPlayer matchId={detail.fixture.id} />
        )}
      </div>
    </div>
  );
}

function OverviewPanel({
  detail,
  likelyProps,
  positionalCount,
  fullMatchHref,
  onOpenTab,
}: {
  detail: MatchDetailPayload;
  likelyProps: PickStat[];
  positionalCount: number;
  fullMatchHref?: string;
  onOpenTab: (tab: MatchFeatureTab) => void;
}) {
  const topProps = likelyProps.slice(0, 4);
  const pickTeasers = detail.matchups
    .map((m) => m.pickOfTheDay)
    .filter((p): p is PickStat => Boolean(p))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetaChip
          label="Duels"
          value={`${positionalCount}`}
          onClick={() => onOpenTab("matchups")}
        />
        <MetaChip
          label="Formation"
          value={
            detail.homeFormation && detail.awayFormation
              ? `${detail.homeFormation} · ${detail.awayFormation}`
              : "TBD"
          }
          onClick={() => onOpenTab("lineups")}
        />
        <MetaChip
          label="Stage"
          value={detail.fixture.stage || "—"}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {topProps.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            Likely to happen
          </p>
          <ul className="flex flex-col gap-1.5">
            {topProps.map((p) => (
              <li
                key={p.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-surface px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">{p.label}</span>
                <span className="tabular shrink-0 font-bold text-accent">
                  {formatPct(p.rate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pickTeasers.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            Picks of the day
          </p>
          <ul className="flex flex-col gap-1.5">
            {pickTeasers.map((p) => (
              <li
                key={`${p.playerId}-${p.label}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">{p.label}</span>
                <span className="tabular shrink-0 font-bold text-gold">
                  {formatPct(p.rate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onOpenTab("lineups")}
          className="rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent/40 hover:text-foreground"
        >
          View lineups
        </button>
        <button
          type="button"
          onClick={() => onOpenTab("matchups")}
          className="rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent/40 hover:text-foreground"
        >
          View matchups
        </button>
        <button
          type="button"
          onClick={() => onOpenTab("stars")}
          className="rounded-lg border border-edge px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent/40 hover:text-foreground"
        >
          Star players
        </button>
        {fullMatchHref && (
          <Link
            href={fullMatchHref}
            className="rounded-lg bg-accent/15 px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/25"
          >
            Open full match view →
          </Link>
        )}
      </div>
    </div>
  );
}

function MetaChip({
  label,
  value,
  onClick,
  className = "",
}: {
  label: string;
  value: string;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`rounded-xl border border-edge bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent/40 ${className}`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border border-edge bg-surface px-3 py-2.5 ${className}`}
    >
      {inner}
    </div>
  );
}
