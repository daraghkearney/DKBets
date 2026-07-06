import type { MatchDetailPayload } from "./types";

/** Official lineups are typically announced ~15 minutes before kickoff. */
export const LINEUP_CONFIRM_LEAD_MS = 15 * 60_000;

export type EffectiveLineupStatus = "confirmed" | "predicted" | "pending";

export function lineupConfirmAt(kickoffIso: string): Date {
  return new Date(new Date(kickoffIso).getTime() - LINEUP_CONFIRM_LEAD_MS);
}

export function effectiveLineupStatus(
  detail: Pick<
    MatchDetailPayload,
    "lineupType" | "fixture" | "homeLineup" | "awayLineup"
  >,
  now = new Date()
): EffectiveLineupStatus {
  const hasStarters =
    (detail.homeLineup?.length ?? 0) >= 11 ||
    (detail.awayLineup?.length ?? 0) >= 11;
  if (!hasStarters && detail.lineupType === "none") return "pending";

  if (detail.fixture.finished || detail.lineupType === "confirmed") {
    return "confirmed";
  }

  const confirmAt = lineupConfirmAt(detail.fixture.kickoff);
  if (now >= confirmAt) return "confirmed";

  return "predicted";
}

export function msUntilLineupConfirm(kickoffIso: string, now = new Date()): number {
  return Math.max(0, lineupConfirmAt(kickoffIso).getTime() - now.getTime());
}

export function formatLineupCountdown(ms: number): string {
  if (ms <= 0) return "Any moment now";
  const totalSec = Math.ceil(ms / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
