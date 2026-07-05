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
  todaysPick: BuilderSlip | null;
  builders: Record<string, BuilderSlip | null>;
  targets: OddsTarget[];
  legPoolSize: number;
  generatedAt: string;
}
