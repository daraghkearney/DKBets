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
}

export interface BuilderSlip {
  id: string;
  title: string;
  legs: BuilderLeg[];
  combinedDecimal: number;
  combinedFractional: string;
  combinedProbability: number;
  targetLabel?: string;
}

export interface OddsTarget {
  id: string;
  label: string;
  decimalMin: number;
  decimalMax: number;
}

export interface BuilderComposedView {
  todaysPick: BuilderSlip | null;
  builders: Record<string, BuilderSlip | null>;
}

/** Pre-built slips keyed by maxLegs → scope (instant client scope switching). */
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
}
