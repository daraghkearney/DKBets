export type SportId = "football" | "nba" | "horse-racing";

export interface CompetitionConfig {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  tagline: string;
  /** Whether export pipeline is live for this competition */
  live: boolean;
  dataSource: string;
  features: string[];
  accent: string;
  accentDim: string;
}

export interface SportConfig {
  id: SportId;
  label: string;
  emoji: string;
  headline: string;
  description: string;
  gradient: string;
  glow: string;
  accent: string;
  dataSource: string;
  competitions: CompetitionConfig[];
}

export const SPORTS: SportConfig[] = [
  {
    id: "football",
    label: "Football",
    emoji: "⚽",
    headline: "Deep player stats, matchups & builder intelligence",
    description:
      "FotMob-powered tournament and league analysis with live Bet365 props, 1v1 duels and context-backed builders.",
    gradient: "from-emerald-600/20 via-[#07090f] to-cyan-900/15",
    glow: "shadow-[0_0_80px_rgba(34,197,94,0.15)]",
    accent: "#22c55e",
    dataSource: "FotMob",
    competitions: [
      {
        id: "world-cup",
        label: "FIFA World Cup",
        shortLabel: "World Cup",
        description: "2026 tournament — full odds, stats, lineups & builder.",
        tagline: "Live · Full data",
        live: true,
        dataSource: "FotMob",
        features: ["Odds & arbs", "Bet365 builder", "1v1 matchups", "Lineups"],
        accent: "#22c55e",
        accentDim: "#14532d",
      },
      {
        id: "premier-league",
        label: "English Premier League",
        shortLabel: "Premier League",
        description: "EPL props, form tables and positional matchup models.",
        tagline: "Coming soon",
        live: false,
        dataSource: "FotMob",
        features: ["Player props", "Team models", "H2H duels"],
        accent: "#3b82f6",
        accentDim: "#1e3a8a",
      },
      {
        id: "champions-league",
        label: "UEFA Champions League",
        shortLabel: "Champions League",
        description: "Knockout-stage intelligence and star-player specials.",
        tagline: "Coming soon",
        live: false,
        dataSource: "FotMob",
        features: ["Star players", "Knockout form", "Builder legs"],
        accent: "#6366f1",
        accentDim: "#312e81",
      },
      {
        id: "la-liga",
        label: "La Liga",
        shortLabel: "La Liga",
        description: "Spanish league shot, foul and card prop models.",
        tagline: "Coming soon",
        live: false,
        dataSource: "FotMob",
        features: ["Player stats", "Team tendencies"],
        accent: "#f59e0b",
        accentDim: "#78350f",
      },
    ],
  },
  {
    id: "nba",
    label: "NBA",
    emoji: "🏀",
    headline: "Player props, usage rates & game scripts",
    description:
      "NBA.com stats pipeline — points, rebounds, assists, 3PM and defensive matchup edges with probability-backed builders.",
    gradient: "from-orange-600/25 via-[#07090f] to-red-900/15",
    glow: "shadow-[0_0_80px_rgba(249,115,22,0.18)]",
    accent: "#f97316",
    dataSource: "NBA.com Stats",
    competitions: [
      {
        id: "nba",
        label: "NBA Regular Season & Playoffs",
        shortLabel: "NBA",
        description: "Full season player leaderboards, game logs and prop models.",
        tagline: "Live · Stats export",
        live: true,
        dataSource: "NBA.com Stats",
        features: ["Player leaderboards", "Game logs", "Prop builder", "Matchup edges"],
        accent: "#f97316",
        accentDim: "#7c2d12",
      },
    ],
  },
  {
    id: "horse-racing",
    label: "Horse Racing",
    emoji: "🏇",
    headline: "Form, course fit & elite tipster intelligence",
    description:
      "Distance suitability, course history, jockey/trainer form and Tavily-sourced tipster consensus from proven racing analysts.",
    gradient: "from-amber-500/20 via-[#07090f] to-emerald-900/10",
    glow: "shadow-[0_0_80px_rgba(251,191,36,0.12)]",
    accent: "#fbbf24",
    dataSource: "Racing API + Web",
    competitions: [
      {
        id: "todays-races",
        label: "Today's Races",
        shortLabel: "Today",
        description: "All UK & Ireland cards — deep form, distance fit and tipster scan.",
        tagline: "Live · Daily cards",
        live: true,
        dataSource: "Racing + Tavily",
        features: ["Daily cards", "Distance analysis", "Course form", "Tipster scan"],
        accent: "#fbbf24",
        accentDim: "#78350f",
      },
      {
        id: "cheltenham",
        label: "Cheltenham Festival",
        shortLabel: "Cheltenham",
        description: "Festival specialists, course form and proven tipster track records.",
        tagline: "Festival focus",
        live: true,
        dataSource: "Racing + Tavily",
        features: ["Course history", "Trip suitability", "Elite tipsters"],
        accent: "#22c55e",
        accentDim: "#14532d",
      },
      {
        id: "punchestown",
        label: "Punchestown Festival",
        shortLabel: "Punchestown",
        description: "Irish festival form, stamina tests and reliable Irish racing tips.",
        tagline: "Festival focus",
        live: true,
        dataSource: "Racing + Tavily",
        features: ["Irish form", "Stamina profile", "Tipster consensus"],
        accent: "#a855f7",
        accentDim: "#581c87",
      },
      {
        id: "aintree",
        label: "Aintree · Grand National",
        shortLabel: "Aintree",
        description: "National Hunt stamina, fence form and Grand National specialists.",
        tagline: "Coming soon",
        live: false,
        dataSource: "Racing + Tavily",
        features: ["Stamina", "Fence form", "National specialists"],
        accent: "#ef4444",
        accentDim: "#7f1d1d",
      },
    ],
  },
];

export function getSport(id: string): SportConfig | undefined {
  return SPORTS.find((s) => s.id === id);
}

export function getCompetition(
  sportId: string,
  competitionId: string
): CompetitionConfig | undefined {
  return getSport(sportId)?.competitions.find((c) => c.id === competitionId);
}

export function isSportId(id: string): id is SportId {
  return SPORTS.some((s) => s.id === id);
}
