import Link from "next/link";
import type { CompetitionConfig, SportConfig } from "@/lib/sports/config";
import { competitionRoute } from "@/lib/sports/paths";

export default function CompetitionCard({
  sport,
  competition,
}: {
  sport: SportConfig;
  competition: CompetitionConfig;
}) {
  const href = competitionRoute(sport.id, competition.id);

  return (
    <Link
      href={competition.live ? href : "#"}
      aria-disabled={!competition.live}
      className={`group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
        competition.live
          ? "border-edge/80 bg-surface hover:-translate-y-0.5 hover:border-white/10"
          : "cursor-not-allowed border-edge/40 bg-surface/40 opacity-60"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: competition.accent }}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: competition.accent }}
          >
            {competition.tagline}
          </p>
          <h3 className="mt-1 text-lg font-bold">{competition.label}</h3>
        </div>
        <span className="text-2xl opacity-80">{sport.emoji}</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted">
        {competition.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {competition.features.map((f) => (
          <span
            key={f}
            className="rounded-lg border border-edge/60 bg-background/40 px-2 py-1 text-[10px] font-semibold text-muted"
          >
            {f}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between text-xs">
        <span className="text-muted">{competition.dataSource}</span>
        {competition.live ? (
          <span
            className="font-bold transition-transform group-hover:translate-x-1"
            style={{ color: competition.accent }}
          >
            Open hub →
          </span>
        ) : (
          <span className="font-semibold text-muted">Coming soon</span>
        )}
      </div>
    </Link>
  );
}
