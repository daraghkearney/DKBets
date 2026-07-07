"use client";

import type { ContextInsightKind, MatchContextReport } from "@/lib/builder/context-types";

const KIND_LABEL: Record<ContextInsightKind, string> = {
  player_duel: "Player duel",
  team_tendency: "Team tendency",
  formation: "Formation",
  tactical_edge: "Tactical edge",
  career_h2h: "Career H2H",
  tournament_form: "Tournament form",
};

const KIND_COLOR: Record<ContextInsightKind, string> = {
  player_duel: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  team_tendency: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  formation: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  tactical_edge: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  career_h2h: "text-gold border-gold/40 bg-gold/10",
  tournament_form: "text-sky-400 border-sky-500/30 bg-sky-500/10",
};

export default function MatchContextPanel({
  reports,
  matchId,
}: {
  reports: MatchContextReport[];
  matchId?: number;
}) {
  const visible = matchId
    ? reports.filter((r) => r.matchId === matchId)
    : reports.slice(0, 4);

  if (!visible.length) {
    return (
      <p className="rounded-xl border border-edge bg-surface/50 px-4 py-6 text-sm text-muted">
        No context research available for this scope yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {visible.map((report) => (
        <article
          key={report.matchId}
          className="overflow-hidden rounded-2xl border border-edge bg-gradient-to-br from-surface via-surface to-surface-2"
        >
          <div className="border-b border-edge/60 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#3ecf8e]">
              Match context
            </p>
            <h3 className="text-base font-bold">{report.matchLabel}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {report.summary}
            </p>
            {report.homeFormation && report.awayFormation && (
              <p className="mt-1 text-[11px] text-muted">
                Formations: {report.homeFormation} vs {report.awayFormation}
              </p>
            )}
          </div>

          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
            {report.insights.slice(0, 8).map((insight) => (
              <div
                key={insight.id}
                className={`rounded-xl border p-3 ${KIND_COLOR[insight.kind]}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                    {KIND_LABEL[insight.kind]}
                  </p>
                  <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold tabular">
                    {Math.round(insight.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {insight.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  {insight.body}
                </p>
              </div>
            ))}
          </div>

          {report.duels.filter((d) => d.careerMeetings >= 1).length > 0 && (
            <div className="border-t border-edge/60 px-4 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                Key positional channels
              </p>
              <div className="flex flex-col gap-2">
                {report.duels
                  .filter((d) => d.careerMeetings >= 1)
                  .slice(0, 4)
                  .map((d) => (
                    <p
                      key={`${d.playerA}-${d.playerB}`}
                      className="rounded-lg border border-edge/50 bg-background/30 px-3 py-2 text-xs text-muted"
                    >
                      <strong className="text-foreground">{d.slot}</strong> —{" "}
                      {d.narrative}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
