/**
 * Live football competitions for stats + Bet365 odds.
 * World Cup (FotMob 77) is archived.
 */

/** FotMob league id — English Premier League */
export const PRIMARY_FOOTBALL_LEAGUE_ID = 47;

/** FotMob league id — UEFA Champions League */
export const CHAMPIONS_LEAGUE_ID = 42;

/** Legacy World Cup league id (archive / reference only) */
export const WORLD_CUP_LEAGUE_ID = 77;

/** odds-api.io league slug for Bet365 props */
export const PRIMARY_ODDS_API_LEAGUE = "england-premier-league";
export const CHAMPIONS_LEAGUE_ODDS_API = "uefa-champions-league";

export const PRIMARY_FOOTBALL_COMPETITION_ID = "premier-league";
export const PRIMARY_FOOTBALL_LABEL = "Premier League";

export const CHAMPIONS_LEAGUE_COMPETITION_ID = "champions-league";
export const CHAMPIONS_LEAGUE_LABEL = "Champions League";

export interface FootballCompetitionMeta {
  id: string;
  label: string;
  shortLabel: string;
  fotmobLeagueId: number;
  oddsApiLeague: string;
  /** When true, export + hub are active */
  live: boolean;
  /**
   * Premier League keeps the legacy flat `/data/samples/{mode}/` paths.
   * Other competitions use `/data/football/{id}/samples/{mode}/`.
   */
  dataRoot: "legacy" | "scoped";
}

export const FOOTBALL_COMPETITIONS: FootballCompetitionMeta[] = [
  {
    id: PRIMARY_FOOTBALL_COMPETITION_ID,
    label: PRIMARY_FOOTBALL_LABEL,
    shortLabel: "EPL",
    fotmobLeagueId: PRIMARY_FOOTBALL_LEAGUE_ID,
    oddsApiLeague: PRIMARY_ODDS_API_LEAGUE,
    live: true,
    dataRoot: "legacy",
  },
  {
    id: CHAMPIONS_LEAGUE_COMPETITION_ID,
    label: CHAMPIONS_LEAGUE_LABEL,
    shortLabel: "UCL",
    fotmobLeagueId: CHAMPIONS_LEAGUE_ID,
    oddsApiLeague: CHAMPIONS_LEAGUE_ODDS_API,
    live: true,
    dataRoot: "scoped",
  },
];

export function footballCompetition(
  id: string
): FootballCompetitionMeta | undefined {
  return FOOTBALL_COMPETITIONS.find((c) => c.id === id);
}

export function liveFootballCompetitions(): FootballCompetitionMeta[] {
  return FOOTBALL_COMPETITIONS.filter((c) => c.live);
}
