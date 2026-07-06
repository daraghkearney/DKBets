export type StatsSampleMode =
  | "wc2026"
  | "wc-qual"
  | "alltime-nt"
  | "last50";

export interface SampleModeOption {
  id: StatsSampleMode;
  label: string;
  shortLabel: string;
  description: string;
}

export const SAMPLE_MODES: SampleModeOption[] = [
  {
    id: "wc2026",
    label: "World Cup 2026 Stats",
    shortLabel: "WC 2026",
    description: "Finished World Cup 2026 tournament matches only.",
  },
  {
    id: "wc-qual",
    label: "WC 2026 + Qualification",
    shortLabel: "WC + Qual",
    description: "World Cup 2026 and qualification matches combined.",
  },
  {
    id: "alltime-nt",
    label: "All Time National Team Stats",
    shortLabel: "National team",
    description:
      "International matches from each player's FotMob profile (World Cup, Euros, qualifiers, friendlies).",
  },
  {
    id: "last50",
    label: "Player Last 50 Games",
    shortLabel: "Last 50",
    description:
      "Last 50 club and international appearances per squad player (all competitions).",
  },
];

export const DEFAULT_SAMPLE_MODE: StatsSampleMode = "wc2026";

export function isStatsSampleMode(value: string): value is StatsSampleMode {
  return SAMPLE_MODES.some((m) => m.id === value);
}

export function sampleModeLabel(mode: StatsSampleMode): string {
  return SAMPLE_MODES.find((m) => m.id === mode)?.label ?? mode;
}
