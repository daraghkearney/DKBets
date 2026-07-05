export type BookmakerId = string;

export interface Bookmaker {
  id: BookmakerId;
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  url: string;
  /** primary = the books this project targets; extra = bonus books found via Oddsscanner */
  tier: "primary" | "extra";
  /** false when the bookmaker blocks all automated access and no feed exists */
  available: boolean;
  /** which markets this book has data for */
  coverage: "full" | "match_result" | "none";
  note?: string;
}

export type MarketType =
  | "match_result"
  | "to_qualify"
  | "btts"
  | "over_under_2_5";

export interface OutcomeOdds {
  key: string;
  label: string;
  /** Decimal odds per bookmaker; null/absent = not offered */
  odds: Record<BookmakerId, number | null>;
}

export interface Market {
  id: string;
  type: MarketType;
  name: string;
  outcomes: OutcomeOdds[];
}

export interface Match {
  id: string;
  kickoff: string; // ISO datetime
  stage: string;
  venue?: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  markets: Market[];
}

export interface SourceStatus {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface OddsSnapshot {
  generatedAt: string;
  source: "live" | "simulated";
  sourceLabel: string;
  sources: SourceStatus[];
  matches: Match[];
}

export interface ArbLeg {
  outcomeKey: string;
  outcomeLabel: string;
  bookmaker: BookmakerId;
  odds: number;
  /** Fraction of the total stake that goes on this leg (0..1) */
  share: number;
}

export interface ArbOpportunity {
  id: string;
  matchId: string;
  matchLabel: string;
  homeFlag: string;
  awayFlag: string;
  kickoff: string;
  stage: string;
  marketId: string;
  marketName: string;
  marketType: MarketType;
  legs: ArbLeg[];
  /** Sum of 1/odds across best prices. < 1 means guaranteed profit. */
  impliedTotal: number;
  /** Guaranteed return on total stake, e.g. 0.021 = 2.1% */
  profitPct: number;
}
