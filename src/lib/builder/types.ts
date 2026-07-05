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
  /** Bet365 live or calibrated to Bet365 ladder */
  oddsSource: "bet365_live" | "bet365_calibrated";
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

export interface BuilderPayload {
  /** Full leg pool — client composes slips with scope / max-legs filters */
  legs: BuilderLeg[];
  fixtures: Array<{
    id: number;
    home: string;
    away: string;
    kickoff: string;
  }>;
  targets: OddsTarget[];
  bet365LiveLegs: number;
  generatedAt: string;
}
