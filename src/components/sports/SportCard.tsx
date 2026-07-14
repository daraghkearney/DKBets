import Link from "next/link";
import type { SportConfig } from "@/lib/sports/config";
import { sportRoute } from "@/lib/sports/paths";

export default function SportCard({ sport }: { sport: SportConfig }) {
  const liveCount = sport.competitions.filter((c) => c.live).length;

  return (
    <Link
      href={sportRoute(sport.id)}
      className={`group relative overflow-hidden rounded-3xl border border-edge/80 bg-gradient-to-br ${sport.gradient} p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/10 ${sport.glow}`}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
        style={{ backgroundColor: sport.accent }}
      />

      <div className="relative">
        <div className="mb-4 flex items-start justify-between">
          <span className="text-4xl">{sport.emoji}</span>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${sport.accent}22`,
              color: sport.accent,
            }}
          >
            {liveCount} live
          </span>
        </div>

        <h2 className="text-2xl font-bold tracking-tight">{sport.label}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {sport.description}
        </p>

        <ul className="mt-4 flex flex-col gap-1.5">
          {sport.competitions.slice(0, 3).map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 text-xs text-muted"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: c.live ? sport.accent : "#4b5563",
                }}
              />
              {c.shortLabel}
              {!c.live && (
                <span className="text-[10px] uppercase opacity-60">soon</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-end">
          <span
            className="text-sm font-bold transition-transform group-hover:translate-x-1"
            style={{ color: sport.accent }}
          >
            Enter →
          </span>
        </div>
      </div>
    </Link>
  );
}
