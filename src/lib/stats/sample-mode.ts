import {
  CHAMPIONS_LEAGUE_COMPETITION_ID,
  PRIMARY_FOOTBALL_COMPETITION_ID,
  footballCompetition,
} from "@/lib/sports/football";

export type StatsSampleMode = "epl-season" | "last50";

export interface SampleModeOption {
  id: StatsSampleMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const SAMPLE_MODES: SampleModeOption[] = [
  {
    id: "epl-season",
    label: "Premier League season",
    shortLabel: "EPL season",
    description:
      "Finished Premier League matches (uses last completed season until the new one has results).",
  },
  {
    id: "last50",
    label: "Player last 50 games",
    shortLabel: "Last 50",
    description:
      "Last 50 club appearances per squad player (all competitions).",
  },
];

export const DEFAULT_SAMPLE_MODE: StatsSampleMode = "epl-season";

export function isStatsSampleMode(value: string): value is StatsSampleMode {
  return SAMPLE_MODES.some((m) => m.id === value);
}

export function sampleModeLabel(mode: StatsSampleMode): string {
  return SAMPLE_MODES.find((m) => m.id === mode)?.label ?? mode;
}

/** Competition-aware labels — same mode ids / pipeline, clearer UI copy. */
export function sampleModesForCompetition(
  competitionId: string
): SampleModeOption[] {
  const meta = footballCompetition(competitionId);
  const label = meta?.label ?? "League";

  if (competitionId === CHAMPIONS_LEAGUE_COMPETITION_ID) {
    return [
      {
        id: "epl-season",
        label: "Champions League season",
        shortLabel: "UCL season",
        description:
          "Finished Champions League matches (uses last completed season until the new one has results).",
      },
      {
        id: "last50",
        label: "Player last 50 games",
        shortLabel: "Last 50",
        description:
          "Last 50 club appearances per squad player (all competitions).",
      },
    ];
  }

  if (competitionId === PRIMARY_FOOTBALL_COMPETITION_ID || !meta) {
    return SAMPLE_MODES;
  }

  return [
    {
      id: "epl-season",
      label: `${label} season`,
      shortLabel: "Season",
      description: `Finished ${label} matches (uses last completed season until the new one has results).`,
    },
    SAMPLE_MODES[1]!,
  ];
}
