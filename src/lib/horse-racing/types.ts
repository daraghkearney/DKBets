export interface HorseFormRun {
  date: string;
  course: string;
  distance: string;
  distanceYards: number;
  going: string;
  position: number;
  runners: number;
  jockey: string;
  trainer: string;
  weight: string;
  odds: string;
  comment: string;
}

export interface HorseRunner {
  id: string;
  name: string;
  age: number;
  weight: string;
  jockey: string;
  trainer: string;
  form: string;
  odds: number | null;
  formRuns: HorseFormRun[];
  distanceFitScore: number;
  courseFitScore: number;
  recentFormScore: number;
  goingFitScore: number;
  freshnessScore: number;
  marketScore: number;
  tipsterScore: number;
  overallScore: number;
  predictedRank?: number;
  notes: string[];
}

export interface HorseRace {
  id: string;
  date?: string;
  time: string;
  name: string;
  course: string;
  distance: string;
  distanceYards: number;
  going: string;
  raceClass: string;
  runners: HorseRunner[];
}

export interface RacingMeeting {
  id: string;
  name: string;
  region?: string;
  races: HorseRace[];
}

export interface RacingCalendarDay {
  date: string;
  label: string;
  meetings: RacingMeeting[];
}

export interface RacingCalendarPayload {
  source: string;
  sourceLabel: string;
  exportedAt: string;
  racingApiDebug?: string;
  days: RacingCalendarDay[];
  /** Day-level tipster intel (filtered client-side by meeting) */
  tipsters: TipsterPick[];
  /** Current learned model state (weights + sample size) */
  model?: RacingModelInfo;
  /** Review of yesterday's winners vs our predictions */
  review?: RacingWinnerReview;
}

export type RacingFactorKey =
  | "market"
  | "going"
  | "distance"
  | "course"
  | "form"
  | "freshness"
  | "tipster";

export interface RacingModelInfo {
  weights: Record<RacingFactorKey, number>;
  /** Number of completed races the weights were learned from */
  samples: number;
  updatedAt: string;
  /** Mean factor edge of winners vs field, per factor */
  factorEdges?: Partial<Record<RacingFactorKey, number>>;
}

export interface RacingWinnerReviewRace {
  raceId: string;
  course: string;
  time: string;
  name: string;
  winner: string;
  winnerSp?: number;
  /** Where our model ranked the winner (1 = we predicted it) */
  ourRank?: number;
  fieldSize?: number;
  /** Factors where the winner led the field — what would have found it */
  winningFactors: RacingFactorKey[];
}

export interface RacingWinnerReview {
  date: string;
  races: RacingWinnerReviewRace[];
  correctWinners: number;
  totalRaces: number;
  summary: string;
}

export interface TipsterPick {
  id: string;
  tipster: string;
  horse: string;
  raceId: string;
  confidence: number;
  trackRecord: string;
  sourceUrl?: string;
  rationale: string;
}

export interface HorseRacingPayload {
  meeting: string;
  meetingLabel: string;
  date: string;
  source: string;
  sourceLabel: string;
  exportedAt: string;
  races: HorseRace[];
  tipsters: TipsterPick[];
  researchSummary: string;
  /** Present when live API was attempted — helps diagnose demo fallback */
  racingApiDebug?: string;
}
