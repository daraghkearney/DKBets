/** One player's numbers from a single finished match. */
export interface PlayerMatchLine {
  matchId: number;
  opponent: string;
  date: string;
  competition: string;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  foulsCommitted: number;
  foulsWon: number;
  tackles: number;
  duelsWon: number;
  yellowCards: number;
  redCards: number;
}

export interface PlayerTournamentStats {
  playerId: number;
  name: string;
  teamId: number;
  teamName: string;
  lines: PlayerMatchLine[];
  totals: StatTotals;
  per90: StatTotals;
}

export interface StatTotals {
  matches: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  foulsCommitted: number;
  foulsWon: number;
  tackles: number;
  duelsWon: number;
  yellowCards: number;
  redCards: number;
}

export interface LineupPlayer {
  id: number;
  name: string;
  shirtNumber: string;
  positionLabel: string;
  band: "GK" | "DF" | "MF" | "FW";
  x: number; // 0..1 depth (lower = more defensive)
  y: number; // 0..1 lateral (lower = left flank, higher = right flank)
}

export interface FixtureSummary {
  id: number;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  kickoff: string;
  stage: string;
  started: boolean;
  finished: boolean;
}

/** A prop-bet template evaluated against real match lines. */
export interface PickStat {
  label: string; // e.g. "1+ shots on target"
  playerId: number;
  playerName: string;
  teamName: string;
  /** hits in head-to-head meetings between the two players */
  h2hHits: number;
  h2hSample: number;
  /** hits across this World Cup */
  tournamentHits: number;
  tournamentSample: number;
  /** combined hit rate 0..1 */
  rate: number;
  sample: number;
}

export interface Matchup {
  id: string;
  /** Positional duel type, e.g. "Left Winger vs Right-Back". */
  slot: string;
  label: string;
  kind: "positional" | "notable";
  a: MatchupSide;
  b: MatchupSide;
  /** Meetings in FotMob recent-match history (club + international). */
  careerH2hGames: number;
  isCareerRivalry: boolean;
  history: MatchupHistoryRow[];
  pickOfTheDay: PickStat | null;
  picks: PickStat[];
}

export interface MatchupSide {
  player: LineupPlayer;
  teamName: string;
  stats: PlayerTournamentStats | null;
}

export interface MatchupHistoryRow {
  matchId: number;
  date: string;
  competition: string;
  score: string;
  a: PlayerMatchLine;
  b: PlayerMatchLine;
}

export interface MatchDetailPayload {
  fixture: FixtureSummary;
  lineupType: "confirmed" | "predicted" | "none";
  homeFormation: string | null;
  awayFormation: string | null;
  matchups: Matchup[];
  generatedAt: string;
}

export interface BankerPick extends PickStat {
  matchLabel: string;
  matchupLabel: string;
  kickoff: string;
}
