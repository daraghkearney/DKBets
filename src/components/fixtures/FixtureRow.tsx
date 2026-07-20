"use client";

import { formatKickoff, formatPct } from "@/lib/format";
import type { FixtureSummary, PickStat } from "@/lib/stats/types";
import TeamCrest from "./TeamCrest";

export type FixtureRowData = FixtureSummary & {
  likelyProps?: PickStat[];
};

export default function FixtureRow({
  fixture,
  expanded,
  onToggle,
}: {
  fixture: FixtureRowData;
  expanded: boolean;
  onToggle: () => void;
}) {
  const teaser = fixture.likelyProps?.[0];
  const timeLabel = fixture.finished
    ? "FT"
    : fixture.started
      ? "LIVE"
      : formatKickoff(fixture.kickoff);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`group w-full border-b border-edge/60 px-3 py-4 text-left transition-colors last:border-b-0 sm:px-5 ${
        expanded
          ? "bg-surface-2/80"
          : "bg-surface hover:bg-surface-2/50 active:bg-surface-2/70"
      }`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <span className="truncate text-right text-sm font-medium leading-snug text-foreground sm:text-[15px]">
            {fixture.home}
          </span>
          <TeamCrest teamId={fixture.homeId} name={fixture.home} size={28} />
        </div>

        <div className="flex w-16 flex-col items-center justify-center sm:w-20">
          <span
            className={`tabular text-sm font-bold tracking-tight ${
              fixture.started && !fixture.finished
                ? "text-accent"
                : "text-foreground"
            }`}
          >
            {timeLabel}
          </span>
          <span
            className={`mt-0.5 text-[10px] transition-transform duration-200 ${
              expanded ? "rotate-180 text-accent" : "text-muted"
            }`}
            aria-hidden
          >
            ▾
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-start gap-2 sm:gap-3">
          <TeamCrest teamId={fixture.awayId} name={fixture.away} size={28} />
          <span className="truncate text-left text-sm font-medium leading-snug text-foreground sm:text-[15px]">
            {fixture.away}
          </span>
        </div>
      </div>

      {teaser && !expanded && (
        <p className="mt-2 truncate text-center text-[11px] text-muted">
          {teaser.label}{" "}
          <span className="font-semibold text-accent">
            {formatPct(teaser.rate)}
          </span>
        </p>
      )}
    </button>
  );
}
