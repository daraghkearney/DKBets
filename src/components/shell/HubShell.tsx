"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SampleModeProvider } from "@/components/SampleModeProvider";
import SampleModeSelector from "@/components/SampleModeSelector";
import RacingDayMeetingBar from "@/components/horse-racing/RacingDayMeetingBar";
import AuthControls from "@/components/subscription/AuthControls";
import { RacingSelectionProvider } from "@/components/horse-racing/RacingSelectionProvider";
import { useSport } from "@/components/SportProvider";
import { isLandingPath, sportRoute } from "@/lib/sports/paths";
import { BRAND } from "@/lib/brand";

const FOOTBALL_LINKS = [
  { section: "matches", label: "Fixtures" },
  { section: "star-players", label: "Star Player" },
  { section: "builder", label: "Bet365 Builder" },
  { section: "team-model", label: "Team Bet Model" },
  { section: "stats", label: "Player Stats" },
] as const;

const NBA_LINKS = [
  { section: "", label: "Games Hub" },
  { section: "stats", label: "Player Stats" },
  { section: "builder", label: "Prop Builder" },
] as const;

const RACING_LINKS = [
  { section: "", label: "Race Cards" },
  { section: "analysis", label: "Deep Analysis" },
  { section: "tipsters", label: "Tipster Intel" },
] as const;

const RACING_MEETING_HINTS: Record<string, string | undefined> = {
  "todays-races": undefined,
  cheltenham: "cheltenham",
  punchestown: "punchestown",
};

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

  const showSampleSelector = sport === "football" && competition === "premier-league";
  const isRacing = sport === "horse-racing";
  const racingMeetingHint =
    competition && isRacing
      ? RACING_MEETING_HINTS[competition]
      : undefined;

  const body = isRacing ? (
    <RacingSelectionProvider defaultMeetingHint={racingMeetingHint}>
      <RacingDayMeetingBar />
      {children}
    </RacingSelectionProvider>
  ) : (
    children
  );

  return (
    <SampleModeProvider>
      <header className="sticky top-0 z-40 border-b border-edge bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base font-black sm:h-9 sm:w-9 sm:text-lg"
                style={{
                  backgroundColor: `${competitionConfig?.accent ?? "#22c55e"}22`,
                  color: competitionConfig?.accent ?? "#22c55e",
                }}
              >
                {sportConfig?.emoji ?? BRAND.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold leading-tight tracking-tight sm:text-lg">
                  {competitionConfig?.shortLabel ?? BRAND.name}
                  <span className="hidden font-normal text-muted sm:inline">
                    {" "}
                    · {sportConfig?.label}
                  </span>
                </p>
                <p className="hidden text-[11px] text-muted sm:block">
                  {competitionConfig?.tagline ?? "Research hub"}
                </p>
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={sportRoute(sport!)}
                className="hidden rounded-xl border border-edge px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent/40 hover:text-foreground sm:inline-flex"
              >
                ← Change {sport === "horse-racing" ? "meeting" : "competition"}
              </Link>
              <Link
                href={sportRoute(sport!)}
                className="rounded-xl border border-edge px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent/40 hover:text-foreground sm:hidden"
                aria-label={`Change ${sport === "horse-racing" ? "meeting" : "competition"}`}
              >
                ←
              </Link>
              <AuthControls />
            </div>
          </div>
        </div>
        <nav className="border-b border-edge bg-surface/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-0.5 overflow-x-auto px-2 sm:gap-1 sm:px-6">
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
                  className={`relative shrink-0 px-3 py-3.5 text-sm font-medium transition-colors sm:px-4 ${
                    active
                      ? "text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {l.label}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-foreground sm:inset-x-3" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
        {showSampleSelector && <SampleModeSelector />}
      </header>
      {body}
      <footer className="mt-auto border-t border-edge py-6 text-center text-[11px] text-muted">
        {BRAND.name} · {sportConfig?.label} · 18+ · GambleAware.org
      </footer>
    </SampleModeProvider>
  );
}
