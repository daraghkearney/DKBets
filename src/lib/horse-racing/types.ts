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
  /** Race class/grade of the historical run, when known */
  raceClass?: string;
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
  /** Official rating (OFR) when published */
  officialRating: number | null;
  /** Days since last run, from the racecard */
  lastRunDays: number | null;
  headgear: string;
  draw: string;
  formRuns: HorseFormRun[];
  /** Racing Post Rating (scraped) */
  rpr?: number | null;
  /** Topspeed figure (scraped) */
  topspeed?: number | null;
  /** Number of named tipsters backing this runner today */
  tipCount?: number;
  /** Names of tipsters backing this runner */
  tippedBy?: string[];
  /** Expert spotlight comment for today's race */
  spotlight?: string;
  /** Trainer recent strike rate % (scraped) */
  trainerStrikePct?: number | null;
  /** Jockey recent strike rate % (scraped) */
  jockeyStrikePct?: number | null;
  /** Has won at this course before */
  courseWinner?: boolean;
  /** Has won at this distance before */
  distanceWinner?: boolean;
  wonLastTimeOut?: boolean;
  distanceFitScore: number;
  courseFitScore: number;
  recentFormScore: number;
  goingFitScore: number;
  freshnessScore: number;
  marketScore: number;
  tipsterScore: number;
  classFitScore: number;
  ratingScore: number;
  trainerScore: number;
  jockeyScore: number;
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
  /** Pattern/grade, e.g. "Grade 1", "Group 2", "Listed" */
  pattern?: string;
  /** Expert verdict for the race (scraped) */
  verdict?: string;
  /** Model each-way value selection for this race */
  eachWayGem?: EachWayGem;
  runners: HorseRunner[];
}

export interface EachWayGem {
  runnerId: string;
  name: string;
  odds: number | null;
  rationale: string;
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
  /** HorseRacing.net scrape/merge diagnostics */
  hrnDebug?: string;
}

export type RacingFactorKey =
  | "market"
  | "rating"
  | "going"
  | "distance"
  | "course"
  | "form"
  | "class"
  | "trainer"
  | "jockey"
  | "freshness"
  | "tipster";

export interface RacingModelInfo {
  weights: Record<RacingFactorKey, number>;
  /** Number of completed races the weights were learned from */
  samples: number;
  updatedAt: string;
  /** Last results date already learned from (prevents double-counting) */
  lastLearnedDate?: string;
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
  /** Red-hot: elite/high-strike-rate tipster matched to an actual runner */
  hot?: boolean;
  /** Where the tip surfaced, e.g. "reddit", "twitter", "web" */
  platform?: string;
  /** Set when the tipped horse was matched to a runner on today's cards */
  matchedRunner?: string;
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
