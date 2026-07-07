import type { LegCategory } from "./types";

export type ContextInsightKind =
  | "player_duel"
  | "team_tendency"
  | "formation"
  | "tactical_edge"
  | "career_h2h"
  | "tournament_form"
  | "web_preview"
  | "web_h2h"
  | "web_duel";

export type ContextInsightSource = "fotmob" | "web";

export interface ContextInsight {
  id: string;
  kind: ContextInsightKind;
  title: string;
  body: string;
  /** 0–1 confidence in this narrative */
  confidence: number;
  /** Leg categories this insight supports */
  categories: LegCategory[];
  playerNames?: string[];
  matchupSlot?: string;
  source?: ContextInsightSource;
  sourceUrl?: string;
}

export interface DuelStatSummary {
  label: string;
  aHits: number;
  bHits: number;
  sample: number;
  aRate: number;
  bRate: number;
}

export interface DuelContextReport {
  slot: string;
  label: string;
  playerA: string;
  playerB: string;
  careerMeetings: number;
  isRivalry: boolean;
  stats: DuelStatSummary[];
  narrative: string;
}

export interface TeamTendencyReport {
  teamName: string;
  games: number;
  avgShots: number;
  avgSot: number;
  avgFouls: number;
  avgCorners: number;
  shotHitRate: number;
  sotHitRate: number;
  foulHitRate: number;
}

export interface MatchContextReport {
  matchId: number;
  matchLabel: string;
  kickoff: string;
  homeFormation: string | null;
  awayFormation: string | null;
  summary: string;
  insights: ContextInsight[];
  duels: DuelContextReport[];
  homeTendencies: TeamTendencyReport | null;
  awayTendencies: TeamTendencyReport | null;
  /** True when Tavily web research was merged at export. */
  webResearchAvailable?: boolean;
}

export interface ContextBuilderPayload {
  byMatch: Record<string, MatchContextReport>;
  /** Match ids in kickoff order */
  matchIds: number[];
}
