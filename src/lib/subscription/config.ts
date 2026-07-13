/**
 * Subscription tiers and gated features.
 *
 * Configure plans in Clerk Dashboard → Billing → Plans for Users:
 *   - Plan slug: `pro` (All-Access, £24.99/mo recommended)
 *   - Optional feature slugs on the plan (see FEATURES below)
 *
 * Set NEXT_PUBLIC_SUBSCRIPTION_ENABLED=true once Clerk keys are in place.
 */

/** Clerk plan slug for all-access subscription */
export const PRO_PLAN_SLUG = "pro";

export const PRICING = {
  proMonthlyGbp: 24.99,
  proAnnualGbp: 199,
  introMonthlyGbp: 14.99,
  trialDays: 7,
} as const;

/** Granular features — assign these to the `pro` plan in Clerk Dashboard */
export const FEATURES = {
  footballBuilder: "football_builder",
  footballProps: "football_props",
  footballStats: "football_stats",
  racingIntel: "racing_intel",
  racingAnalysis: "racing_analysis",
  nbaProps: "nba_props",
  fullAccess: "full_access",
} as const;

export type FeatureSlug = (typeof FEATURES)[keyof typeof FEATURES];

export function isSubscriptionEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_SUBSCRIPTION_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim())
  );
}

/** Hub sections that require pro (path segment after competition id). */
export const GATED_HUB_SECTIONS: Record<string, FeatureSlug | "plan"> = {
  builder: FEATURES.footballBuilder,
  "star-players": FEATURES.footballProps,
  "team-model": FEATURES.footballProps,
  stats: FEATURES.footballStats,
  analysis: FEATURES.racingAnalysis,
  tipsters: FEATURES.racingIntel,
};

export function hubSectionRequiresPremium(section: string): boolean {
  return section in GATED_HUB_SECTIONS;
}
