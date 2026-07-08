"use client";

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { usePathname } from "next/navigation";
import {
  getCompetition,
  getSport,
  type CompetitionConfig,
  type SportConfig,
  type SportId,
} from "@/lib/sports/config";
import { hubRoute, parseHubPath } from "@/lib/sports/paths";

interface SportContextValue {
  sport: SportId | null;
  competition: string | null;
  sportConfig: SportConfig | null;
  competitionConfig: CompetitionConfig | null;
  hubUrl: (section?: string) => string;
  isHub: boolean;
}

const SportContext = createContext<SportContextValue | null>(null);

export function SportProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const parsed = parseHubPath(pathname);

  const value = useMemo((): SportContextValue => {
    if (!parsed) {
      return {
        sport: null,
        competition: null,
        sportConfig: null,
        competitionConfig: null,
        hubUrl: () => "/",
        isHub: false,
      };
    }

    const sportConfig = getSport(parsed.sport) ?? null;
    const competitionConfig =
      getCompetition(parsed.sport, parsed.competition) ?? null;

    return {
      sport: parsed.sport,
      competition: parsed.competition,
      sportConfig,
      competitionConfig,
      hubUrl: (section = "") =>
        hubRoute(parsed.sport, parsed.competition, section),
      isHub: true,
    };
  }, [pathname, parsed]);

  return (
    <SportContext.Provider value={value}>{children}</SportContext.Provider>
  );
}

export function useSport(): SportContextValue {
  const ctx = useContext(SportContext);
  if (!ctx) {
    throw new Error("useSport must be used within SportProvider");
  }
  return ctx;
}
