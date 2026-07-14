import Link from "next/link";
import { SPORTS } from "@/lib/sports/config";
import { sportRoute } from "@/lib/sports/paths";

export default function SportQuickNav() {
  return (
    <nav
      className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start"
      aria-label="Choose a sport"
    >
      {SPORTS.map((sport) => (
        <Link
          key={sport.id}
          href={sportRoute(sport.id)}
          className="inline-flex items-center gap-1.5 rounded-full border border-edge/80 bg-surface/70 px-3.5 py-2 text-sm font-semibold backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-[0_0_20px_rgba(251,191,36,0.12)]"
          style={{ color: sport.accent }}
        >
          <span aria-hidden>{sport.emoji}</span>
          {sport.label}
        </Link>
      ))}
      <a
        href="#sports"
        className="inline-flex items-center rounded-full border border-dashed border-edge/70 px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-gold/40 hover:text-foreground"
      >
        Compare all ↓
      </a>
    </nav>
  );
}
