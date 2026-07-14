import { FEATURES, type FeatureSlug } from "@/lib/subscription/config";

/** Default: free through World Cup final day (override via env). */
const DEFAULT_FREE_UNTIL = "2026-07-20T23:59:59Z";

const FOOTBALL_FREE_FEATURES: readonly FeatureSlug[] = [
  FEATURES.footballBuilder,
  FEATURES.footballProps,
  FEATURES.footballStats,
];

export function isWorldCupFreeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WORLD_CUP_FREE_ENABLED !== "false";
}

export function getWorldCupFreeEndsAt(): Date | null {
  if (!isWorldCupFreeEnabled()) return null;
  const raw =
    process.env.NEXT_PUBLIC_WORLD_CUP_FREE_UNTIL?.trim() || DEFAULT_FREE_UNTIL;
  const ends = new Date(raw);
  return Number.isNaN(ends.getTime()) ? null : ends;
}

export function isWorldCupFreeActive(at = Date.now()): boolean {
  const ends = getWorldCupFreeEndsAt();
  if (!ends) return false;
  return at < ends.getTime();
}

export function isFootballFreeDuringWorldCup(feature?: FeatureSlug): boolean {
  if (!isWorldCupFreeActive()) return false;
  if (!feature) return false;
  return FOOTBALL_FREE_FEATURES.includes(feature);
}

export function worldCupFreeMsRemaining(at = Date.now()): number {
  const ends = getWorldCupFreeEndsAt();
  if (!ends) return 0;
  return Math.max(0, ends.getTime() - at);
}

export function formatWorldCupFreeEndLabel(): string | null {
  const ends = getWorldCupFreeEndsAt();
  if (!ends) return null;
  return ends.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
