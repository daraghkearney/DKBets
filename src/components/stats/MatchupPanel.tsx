"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatKickoff, formatPct } from "@/lib/format";
import LineupPitch from "@/components/stats/LineupPitch";
import LineupStatusBadge from "@/components/stats/LineupStatusBadge";
import { effectiveLineupStatus } from "@/lib/stats/lineup-status";
import type { LineupPlayer, MatchDetailPayload, Matchup } from "@/lib/stats/types";
import TeamCrest from "@/components/fixtures/TeamCrest";
import StatBlock, { StatToggle } from "./StatBlock";
import PlayerAvatar from "./PlayerAvatar";

function resolveLineups(detail: MatchDetailPayload): {
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  homeBench: LineupPlayer[];
  awayBench: LineupPlayer[];
} {
  if (detail.homeLineup?.length >= 11 || detail.awayLineup?.length >= 11) {
    return {
      homeLineup: detail.homeLineup ?? [],
      awayLineup: detail.awayLineup ?? [],
      homeBench: detail.homeBench ?? [],
      awayBench: detail.awayBench ?? [],
    };
  }
  const home = new Map<number, LineupPlayer>();
  const away = new Map<number, LineupPlayer>();
  for (const m of detail.matchups) {
    home.set(m.a.player.id, m.a.player);
    away.set(m.b.player.id, m.b.player);
  }
  return {
    homeLineup: [...home.values()],
    awayLineup: [...away.values()],
    homeBench: [],
    awayBench: [],
  };
}

export type MatchupPanelSections = "all" | "lineups" | "matchups";

export default function MatchupPanel({
  detail,
  sections = "all",
}: {
  detail: MatchDetailPayload;
  sections?: MatchupPanelSections;
}) {
  const [now, setNow] = useState(() => new Date());
  const lineups = useMemo(() => resolveLineups(detail), [detail]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const lineupStatus = effectiveLineupStatus(
    {
      lineupType: detail.lineupType,
      fixture: detail.fixture,
      homeLineup: lineups.homeLineup,
      awayLineup: lineups.awayLineup,
    },
    now
  );

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
  const highlightedIds =
    sections === "lineups"
      ? []
      : m
        ? [m.a.player.id, m.b.player.id]
        : [];

  const showLineups = sections === "all" || sections === "lineups";
  const showMatchups = sections === "all" || sections === "matchups";

  return (
    <div className="flex flex-col gap-6">
      {showLineups && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
                Lineups
              </h2>
              <p className="text-[11px] text-muted">
                {sections === "all"
                  ? "Select a duel below to highlight both players on the pitch"
                  : "Predicted or confirmed starting elevens"}
              </p>
            </div>
            <LineupStatusBadge
              detail={{
                ...detail,
                homeLineup: lineups.homeLineup,
                awayLineup: lineups.awayLineup,
              }}
            />
          </div>
          <LineupPitch
            homeTeam={detail.fixture.home}
            awayTeam={detail.fixture.away}
            homeFormation={detail.homeFormation}
            awayFormation={detail.awayFormation}
            homeLineup={lineups.homeLineup}
            awayLineup={lineups.awayLineup}
            homeBench={lineups.homeBench}
            awayBench={lineups.awayBench}
            highlightedPlayerIds={highlightedIds}
            dashed={lineupStatus === "predicted"}
          />
        </section>
      )}

      {showMatchups &&
        (!m ? (
          <p className="text-sm text-muted">
            No positional matchups available yet — check back when lineups are
            published.
          </p>
        ) : (
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
              <MatchupDetail matchup={m} lineupStatus={lineupStatus} />
            </div>
          </div>
        ))}
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
  lineupStatus,
}: {
  matchup: Matchup;
  lineupStatus: "confirmed" | "predicted" | "pending";
}) {
  const [mode, setMode] = useState<"total" | "per90">("total");
  const [showHistory, setShowHistory] = useState(false);

  const aStats = matchup.a.stats;
  const bStats = matchup.b.stats;
  const aView = mode === "per90" ? aStats?.per90 : aStats?.totals;
  const bView = mode === "per90" ? bStats?.per90 : bStats?.totals;

  const lineupLabel =
    lineupStatus === "confirmed"
      ? "Confirmed lineup"
      : lineupStatus === "predicted"
        ? "Predicted lineup"
        : "Lineup pending";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-edge bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-accent">
            {matchup.slot}
          </p>
          <p className="text-xs text-muted">
            {lineupLabel}
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
          highlighted
        />
        <PlayerCard
          playerId={matchup.b.player.id}
          name={matchup.b.player.name}
          team={matchup.b.teamName}
          role={matchup.b.player.positionLabel}
          stats={bView}
          mode={mode}
          highlighted
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
  highlighted = false,
}: {
  playerId: number;
  name: string;
  team: string;
  role: string;
  stats: import("@/lib/stats/types").StatTotals | undefined;
  mode: "total" | "per90";
  highlighted?: boolean;
}) {
  const border = highlighted ? "border-gold/50 ring-1 ring-gold/30" : "border-edge";

  if (!stats) {
    return (
      <div className={`rounded-xl border p-4 ${border}`}>
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
    <div className={`rounded-xl border p-4 ${border}`}>
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
  const timeLabel = fixture.finished
    ? "FT"
    : fixture.started
      ? "LIVE"
      : formatKickoff(fixture.kickoff);

  return (
    <div className="mb-6">
      <Link
        href="/football/premier-league/matches/"
        className="text-xs text-muted transition-colors hover:text-accent"
      >
        ← Fixtures
      </Link>

      <div className="mt-4 rounded-2xl border border-edge bg-surface px-4 py-6 sm:px-8">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div className="flex min-w-0 flex-col items-end gap-2">
            <TeamCrest
              teamId={fixture.homeId}
              name={fixture.home}
              size={48}
            />
            <p className="w-full truncate text-right text-base font-bold leading-snug sm:text-xl">
              {fixture.home}
            </p>
          </div>

          <div className="flex flex-col items-center px-2">
            <span
              className={`tabular text-xl font-black tracking-tight sm:text-2xl ${
                fixture.started && !fixture.finished
                  ? "text-accent"
                  : "text-foreground"
              }`}
            >
              {timeLabel}
            </span>
            <p className="mt-1 text-center text-[11px] text-muted">
              {fixture.stage}
            </p>
          </div>

          <div className="flex min-w-0 flex-col items-start gap-2">
            <TeamCrest
              teamId={fixture.awayId}
              name={fixture.away}
              size={48}
            />
            <p className="w-full truncate text-left text-base font-bold leading-snug sm:text-xl">
              {fixture.away}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          {positionalCount} positional duels
          {detail.homeFormation && detail.awayFormation && (
            <>
              {" "}
              · {detail.homeFormation} vs {detail.awayFormation}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
