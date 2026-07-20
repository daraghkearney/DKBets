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
