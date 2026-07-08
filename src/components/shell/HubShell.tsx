"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SampleModeProvider } from "@/components/SampleModeProvider";
import SampleModeSelector from "@/components/SampleModeSelector";
import { useSport } from "@/components/SportProvider";
import { isLandingPath, sportRoute } from "@/lib/sports/paths";

const FOOTBALL_LINKS = [
  { section: "", label: "Odds & Arbs", icon: "◎" },
  { section: "builder", label: "Bet365 Builder", icon: "◈" },
  { section: "star-players", label: "Star Player", icon: "★" },
  { section: "team-model", label: "Team Bet Model", icon: "⬡" },
  { section: "stats", label: "Player Stats", icon: "▤" },
  { section: "matches", label: "Matchups", icon: "⚔" },
] as const;

const NBA_LINKS = [
  { section: "", label: "Games Hub", icon: "◎" },
  { section: "stats", label: "Player Stats", icon: "▤" },
  { section: "builder", label: "Prop Builder", icon: "◈" },
] as const;

const RACING_LINKS = [
  { section: "", label: "Race Cards", icon: "◎" },
  { section: "analysis", label: "Deep Analysis", icon: "◈" },
  { section: "tipsters", label: "Tipster Intel", icon: "★" },
] as const;

export default function HubShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { sport, competition, sportConfig, competitionConfig, hubUrl, isHub } =
    useSport();

  if (!isHub || isLandingPath(pathname)) {
    return <>{children}</>;
  }

  const links =
    sport === "football"
      ? FOOTBALL_LINKS
      : sport === "nba"
        ? NBA_LINKS
        : RACING_LINKS;

  const showSampleSelector = sport === "football" && competition === "world-cup";

  return (
    <SampleModeProvider>
      <header className="sticky top-0 z-40 border-b border-edge bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black"
                style={{
                  backgroundColor: `${competitionConfig?.accent ?? "#22c55e"}22`,
                  color: competitionConfig?.accent ?? "#22c55e",
                }}
              >
                {sportConfig?.emoji ?? "DK"}
              </div>
              <div>
                <p className="text-lg font-bold leading-tight tracking-tight">
                  {competitionConfig?.shortLabel ?? "DKBets"}
                  <span className="font-normal text-muted">
                    {" "}
                    · {sportConfig?.label}
                  </span>
                </p>
                <p className="text-[11px] text-muted">
                  {competitionConfig?.dataSource} ·{" "}
                  {competitionConfig?.tagline ?? "Research hub"}
                </p>
              </div>
            </Link>
            <Link
              href={sportRoute(sport!)}
              className="rounded-xl border border-edge px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent/40 hover:text-foreground"
            >
              ← Change {sport === "horse-racing" ? "meeting" : "competition"}
            </Link>
          </div>
        </div>
        <nav className="border-b border-edge bg-surface/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
            {links.map((l) => {
              const href = hubUrl(l.section);
              const active =
                l.section === ""
                  ? pathname === href || pathname === href.replace(/\/$/, "")
                  : pathname.includes(`/${l.section}`);
              return (
                <Link
                  key={l.section || "home"}
                  href={href}
                  className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors ${
                    active ? "text-accent" : "text-muted hover:text-foreground"
                  }`}
                >
                  <span className="mr-1.5 opacity-70">{l.icon}</span>
                  {l.label}
                  {active && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
        {showSampleSelector && <SampleModeSelector />}
      </header>
      {children}
      <footer className="mt-auto border-t border-edge py-6 text-center text-[11px] text-muted">
        DKBets · {sportConfig?.label} · {competitionConfig?.dataSource} · 18+ ·
        GambleAware.org
      </footer>
    </SampleModeProvider>
  );
}
