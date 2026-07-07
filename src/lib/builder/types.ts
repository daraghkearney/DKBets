export type LegCategory =
  | "shots"
  | "sot"
  | "fouls"
  | "foulsWon"
  | "tackles"
  | "cards"
  | "team";

export interface BuilderLeg {
  id: string;
  type: "player" | "team" | "match";
  label: string;
  /** Bet365-style market wording */
  market: string;
  matchLabel: string;
  matchId: number;
  kickoff: string;
  playerName?: string;
  teamName?: string;
  category: LegCategory;
  hitRate: number;
  sample: number;
  decimalOdds: number;
  fractionalOdds: string;
  /** Live Bet365 price from odds-api.io — we never estimate odds in this section */
  oddsSource: "bet365_live";
  /** Direct Bet365 deep link for this selection (when odds-api.io provides one). */
  bet365Link?: string;
  /** Bet365 internal id pair for sportsbookredirect (eventId-marketId). */
  bet365SelectionId?: string;
  /** Bet365 match page URL from odds-api.io. */
  bet365EventUrl?: string;
  /** Head-to-head hits when pick came from a positional duel. */
  h2hHits?: number;
  h2hSample?: number;
  tournamentHits?: number;
  tournamentSample?: number;
  matchupLabel?: string;
  /** Context research score 0–1 (Add Context mode). */
  contextScore?: number;
  contextNotes?: string[];
  contextBacked?: boolean;
}

export interface UnderpricedGem {
  slip: BuilderSlip;
  description: string;
  edgePct: number;
}

export interface BuilderSlip {
  id: string;
  title: string;
  legs: BuilderLeg[];
  combinedDecimal: number;
  combinedFractional: string;
  combinedProbability: number;
  targetLabel?: string;
  /** Narrative summary for context-backed slips */
  contextSummary?: string;
}

export interface OddsTarget {
  id: string;
  label: string;
  decimalMin: number;
  decimalMax: number;
}

export interface BuilderComposedView {
  todaysPick: BuilderSlip | null;
  underpricedGem: UnderpricedGem | null;
  builders: Record<string, BuilderSlip | null>;
}

/** Pre-built slips keyed by maxLegs → scope (instant client scope switching). */
import type { ContextBuilderPayload } from "./context-types";

export interface BuilderPrecomputed {
  byMaxLegs: Record<
    string,
    {
      today: BuilderComposedView;
      multi: BuilderComposedView;
      single: Record<string, BuilderComposedView>;
    }
  >;
}

export interface BuilderPayload {
  /** Full leg pool — client composes slips with scope / max-legs filters */
  legs: BuilderLeg[];
  /** Pre-composed views for common max-legs values (avoids heavy client work). */
  precomputed?: BuilderPrecomputed;
  /** Context-ranked precomputed views (Add Context mode). */
  contextPrecomputed?: BuilderPrecomputed;
  /** Per-match research reports for Add Context mode. */
  context?: ContextBuilderPayload;
  fixtures: Array<{
    id: number;
    home: string;
    away: string;
    kickoff: string;
  }>;
  targets: OddsTarget[];
  bet365LiveLegs: number;
  /** True when export had live Bet365 prices — builder uses live legs only */
  bet365LiveAvailable: boolean;
  /** True when ODDS_API_IO_KEY was present at export time */
  bet365ApiConfigured: boolean;
  /** Raw live price map size at export (debug) */
  bet365PriceCount?: number;
  generatedAt: string;
  sampleMode?: string;
  sampleLabel?: string;
  /** Tavily API key present at export time */
  webResearchConfigured?: boolean;
  /** Web research ran this export (REFRESH_WEB_RESEARCH / ENABLE_WEB_RESEARCH) */
  webResearchEnabled?: boolean;
}
