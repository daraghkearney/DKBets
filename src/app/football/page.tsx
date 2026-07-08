import Link from "next/link";
import CompetitionCard from "@/components/sports/CompetitionCard";
import { getSport } from "@/lib/sports/config";

export default function FootballPickerPage() {
  const sport = getSport("football");
  if (!sport) return null;

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
      <div className="relative mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="text-xs font-semibold text-muted hover:text-foreground"
        >
          ← All sports
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <span className="text-5xl">{sport.emoji}</span>
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {sport.label}
            </h1>
            <p className="mt-1 text-muted">{sport.headline}</p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
          {sport.description}
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {sport.competitions.map((c) => (
            <CompetitionCard key={c.id} sport={sport} competition={c} />
          ))}
        </div>
      </div>
    </div>
  );
}
