"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatKickoff, formatPct } from "@/lib/format";
import type { MatchDetailPayload, Matchup } from "@/lib/stats/types";
import StatBlock, { StatToggle } from "./StatBlock";
import PlayerAvatar from "./PlayerAvatar";

export default function MatchupPanel({ detail }: { detail: MatchDetailPayload }) {
  const positional = useMemo(
    () => detail.matchups.filter((m) => m.kind === "positional"),
    [detail.matchups]
  );
  const notable = useMemo(
    () => detail.matchups.filter((m) => m.kind === "notable"),
    [detail.matchups]
  );

  const flat = useMemo(
    () => [...positional, ...notable],
    [positional, notable]
  );

  const [selected, setSelected] = useState(0);
  const m = flat[selected];

  if (!m) {
    return (
      <p className="text-sm text-muted">
        No positional matchups available yet — check back when lineups are
        published.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <MatchupSection
          title="Positional duels"
          subtitle="Flanks, channels & central battles"
          matchups={positional}
          flat={flat}
          selected={selected}
          onSelect={setSelected}
        />
        {notable.length > 0 && (
          <MatchupSection
            title="Notable rivalries"
            subtitle="Cross-position career history"
            matchups={notable}
            flat={flat}
            selected={selected}
            onSelect={setSelected}
          />
        )}
      </div>
      <div className="lg:col-span-3">
        <MatchupDetail matchup={m} lineupType={detail.lineupType} />
      </div>
    </div>
  );
}

function MatchupSection({
  title,
  subtitle,
  matchups,
  flat,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  matchups: Matchup[];
  flat: Matchup[];
  selected: number;
  onSelect: (i: number) => void;
}) {
  if (matchups.length === 0) return null;

  return (
    <div>
      <div className="mb-2">
        <p className="text-xs font-bold uppercase tracking-wide text-foreground">
          {title}
        </p>
        <p className="text-[11px] text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-2">
        {matchups.map((mu) => {
          const idx = flat.indexOf(mu);
          const active = idx === selected;
          return (
            <button
              key={mu.id}
              onClick={() => onSelect(idx)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                active
                  ? "border-accent bg-accent/10"
                  : "border-edge bg-surface hover:border-accent/40"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                {mu.slot}
              </p>
              <p className="mt-0.5 font-semibold leading-snug">{mu.label}</p>
              <p className="mt-0.5 text-xs text-muted">
                {mu.a.player.name} vs {mu.b.player.name}
              </p>
              {mu.isCareerRivalry && (
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gold">
                  Known rivalry · {mu.careerH2hGames} career meetings
                </p>
              )}
              {mu.pickOfTheDay && (
                <p className="mt-1 text-[11px] text-accent">
                  Pick: {mu.pickOfTheDay.label} ({formatPct(mu.pickOfTheDay.rate)})
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchupDetail({
  matchup,
  lineupType,
}: {
  matchup: Matchup;
  lineupType: MatchDetailPayload["lineupType"];
}) {
  const [mode, setMode] = useState<"total" | "per90">("total");
  const [showHistory, setShowHistory] = useState(false);

  const aStats = matchup.a.stats;
  const bStats = matchup.b.stats;
  const aView = mode === "per90" ? aStats?.per90 : aStats?.totals;
  const bView = mode === "per90" ? bStats?.per90 : bStats?.totals;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent">
            {matchup.slot}
          </p>
          <p className="text-xs text-muted">
            {lineupType === "confirmed"
              ? "Confirmed lineup"
              : lineupType === "predicted"
                ? "Predicted lineup — updates when confirmed"
                : "Lineup pending"}
            {matchup.isCareerRivalry && (
              <>
                {" "}
                · {matchup.careerH2hGames} career meeting
                {matchup.careerH2hGames === 1 ? "" : "s"} on record
              </>
            )}
          </p>
          <h3 className="text-lg font-bold">{matchup.label}</h3>
          <p className="text-sm text-muted">
            {matchup.a.player.name} vs {matchup.b.player.name}
          </p>
        </div>
        <StatToggle mode={mode} setMode={setMode} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PlayerCard
          playerId={matchup.a.player.id}
          name={matchup.a.player.name}
          team={matchup.a.teamName}
          role={matchup.a.player.positionLabel}
          stats={aView}
          mode={mode}
        />
        <PlayerCard
          playerId={matchup.b.player.id}
          name={matchup.b.player.name}
          team={matchup.b.teamName}
          role={matchup.b.player.positionLabel}
          stats={bView}
          mode={mode}
        />
      </div>

      {matchup.pickOfTheDay && (
        <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gold">
            Pick of the day
          </p>
          <p className="mt-1 font-semibold">{matchup.pickOfTheDay.label}</p>
          <p className="text-xs text-muted">
            Hit rate {formatPct(matchup.pickOfTheDay.rate)} (
            {matchup.pickOfTheDay.h2hHits + matchup.pickOfTheDay.tournamentHits}/
            {matchup.pickOfTheDay.sample} games)
            {matchup.pickOfTheDay.h2hSample > 0 &&
              ` · H2H ${matchup.pickOfTheDay.h2hHits}/${matchup.pickOfTheDay.h2hSample}`}
          </p>
        </div>
      )}

      {matchup.picks.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted">All picks</p>
          <div className="flex flex-col gap-1.5">
            {matchup.picks.slice(0, 6).map((p) => (
              <div
                key={p.label}
                className="flex items-center justify-between rounded-lg border border-edge bg-background/30 px-3 py-2 text-sm"
              >
                <span>{p.label}</span>
                <span className="tabular font-bold text-accent">
                  {formatPct(p.rate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowHistory((v) => !v)}
        className="text-left text-xs font-medium text-accent hover:underline"
      >
        {showHistory ? "Hide" : "Show"} player matchup history (
        {matchup.history.length} shared game
        {matchup.history.length === 1 ? "" : "s"}
        {matchup.isCareerRivalry ? ", incl. club & international" : ""})
      </button>

      {showHistory && matchup.history.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-edge text-muted">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Competition</th>
                <th className="px-3 py-2">{matchup.a.player.name}</th>
                <th className="px-3 py-2">{matchup.b.player.name}</th>
              </tr>
            </thead>
            <tbody>
              {matchup.history.map((row) => (
                <tr key={row.matchId} className="border-b border-edge/50">
                  <td className="px-3 py-2 text-muted">{row.date}</td>
                  <td className="px-3 py-2 text-muted">
                    {row.competition}
                    {row.score ? ` (${row.score})` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <HistoryCells line={row.a} />
                  </td>
                  <td className="px-3 py-2">
                    <HistoryCells line={row.b} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showHistory && matchup.history.length === 0 && (
        <p className="text-xs text-muted">
          No previous meetings found where both players appeared in the same
          match. Picks are based on individual tournament form.
        </p>
      )}
    </div>
  );
}

function PlayerCard({
  playerId,
  name,
  team,
  role,
  stats,
  mode,
}: {
  playerId: number;
  name: string;
  team: string;
  role: string;
  stats: import("@/lib/stats/types").StatTotals | undefined;
  mode: "total" | "per90";
}) {
  if (!stats) {
    return (
      <div className="rounded-xl border border-edge p-4">
        <div className="flex items-center gap-3">
          <PlayerAvatar playerId={playerId} name={name} />
          <div>
            <p className="font-bold">{name}</p>
            <p className="text-xs text-muted">
              {team} · {role}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">No tournament data yet</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-edge p-4">
      <div className="flex items-center gap-3">
        <PlayerAvatar playerId={playerId} name={name} />
        <div>
          <p className="font-bold">{name}</p>
          <p className="text-xs text-muted">
            {team} · {role} · {mode === "per90" ? "per 90" : "tournament"}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <StatBlock totals={stats} mode={mode} />
      </div>
    </div>
  );
}

function HistoryCells({
  line,
}: {
  line: import("@/lib/stats/types").PlayerMatchLine;
}) {
  return (
    <span className="tabular text-muted">
      {line.shots} sh · {line.shotsOnTarget} sot · {line.foulsCommitted} fc ·{" "}
      {line.foulsWon} fw · {line.yellowCards} yc
    </span>
  );
}

export function MatchHeader({ detail }: { detail: MatchDetailPayload }) {
  const { fixture } = detail;
  const positionalCount = detail.matchups.filter(
    (m) => m.kind === "positional"
  ).length;
  return (
    <div className="mb-6">
      <Link href="/matches" className="text-xs text-muted hover:text-accent">
        ← All matchups
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {fixture.home} v {fixture.away}
      </h1>
      <p className="text-sm text-muted">
        {fixture.stage} · {formatKickoff(fixture.kickoff)} UTC ·{" "}
        {positionalCount} positional duels
        {detail.homeFormation && detail.awayFormation && (
          <>
            {" "}
            · {detail.homeFormation} vs {detail.awayFormation}
          </>
        )}
      </p>
    </div>
  );
}
