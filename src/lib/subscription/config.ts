/**
 * Subscription tiers and gated features.
 *
 * Create these plans in Clerk Dashboard → Billing → Plans for Users.
 * Clerk billing is USD-only — prices below are USD; marketing copy may show £/€.
 */

import { getClerkPublishableKey } from "@/lib/subscription/clerkKey";

/** All-access standard plan */
export const PRO_PLAN_SLUG = "pro";

/**
 * Hidden complimentary plan — create in Clerk with Publicly available OFF.
 * Assign manually in Dashboard → Billing → Subscriptions → Change plan.
 * Must include the `full_access` feature. Slug must match Clerk exactly.
 */
export const COMPLIMENTARY_PLAN_SLUG = "family";

export const PRICING = {
  footballMonthlyUsd: 14.99,
  racingMonthlyUsd: 17.99,
  nbaMonthlyUsd: 12.99,
  proMonthlyUsd: 24.99,
  proAnnualUsd: 199,
  proAnnualMonthlyUsd: 16.66,
  /** Display equivalents — rates from $24.99 → £18.63 / €21.83 */
  footballMonthlyGbp: 11.18,
  racingMonthlyGbp: 13.41,
  nbaMonthlyGbp: 9.68,
  proMonthlyGbp: 18.63,
  proAnnualGbp: 148.35,
  proAnnualMonthlyGbp: 12.42,
  footballMonthlyEur: 13.09,
  racingMonthlyEur: 15.71,
  nbaMonthlyEur: 11.35,
  proMonthlyEur: 21.83,
  proAnnualEur: 173.84,
  proAnnualMonthlyEur: 14.55,
  trialDays: 7,
} as const;

/** Granular features — assign to plans in Clerk Dashboard */
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

export interface SubscriptionPlan {
  slug: string;
  name: string;
  tagline: string;
  monthlyUsd: number;
  annualUsd?: number;
  monthlyGbp: number;
  monthlyEur: number;
  annualGbp?: number;
  annualEur?: number;
  annualMonthlyGbp?: number;
  annualMonthlyEur?: number;
  features: FeatureSlug[];
  highlights: string[];
  recommended?: boolean;
  badge?: string;
}

/** Clerk plan slugs — must match Dashboard exactly */
export const PLANS: SubscriptionPlan[] = [
  {
    slug: PRO_PLAN_SLUG,
    name: "All-Access Pro",
    tagline: "Everything across every sport",
    monthlyUsd: PRICING.proMonthlyUsd,
    annualUsd: PRICING.proAnnualUsd,
    monthlyGbp: PRICING.proMonthlyGbp,
    monthlyEur: PRICING.proMonthlyEur,
    annualGbp: PRICING.proAnnualGbp,
    annualEur: PRICING.proAnnualEur,
    annualMonthlyGbp: PRICING.proAnnualMonthlyGbp,
    annualMonthlyEur: PRICING.proAnnualMonthlyEur,
    features: [FEATURES.fullAccess],
    highlights: [
      "Full football, racing & NBA access",
      "Underpriced gems, H2H & team bet model",
      "Value naps, ledger & tipster intel",
      "7-day free trial · annual saves vs monthly",
    ],
    recommended: true,
    badge: "Best value",
  },
  {
    slug: "football",
    name: "Football Pro",
    tagline: "World Cup builders, gems & H2H",
    monthlyUsd: PRICING.footballMonthlyUsd,
    monthlyGbp: PRICING.footballMonthlyGbp,
    monthlyEur: PRICING.footballMonthlyEur,
    features: [
      FEATURES.footballBuilder,
      FEATURES.footballProps,
      FEATURES.footballStats,
    ],
    highlights: [
      "Underpriced gems — incredibly high hit rate",
      "Positional matchups & player head-to-head duels",
      "Team bet model — 100% hit-rate legs",
      "Bet365 builder + star players + stats",
    ],
  },
  {
    slug: "racing",
    name: "Racing Pro",
    tagline: "Naps, model scores & tipster intel",
    monthlyUsd: PRICING.racingMonthlyUsd,
    monthlyGbp: PRICING.racingMonthlyGbp,
    monthlyEur: PRICING.racingMonthlyEur,
    features: [FEATURES.racingIntel, FEATURES.racingAnalysis],
    highlights: [
      "Value naps + performance ledger",
      "13-factor model on every runner",
      "Deep analysis + tipster league feeds",
      "Full racecards beyond the free top pick",
    ],
  },
  {
    slug: "nba",
    name: "NBA Pro",
    tagline: "Prop models & builder legs",
    monthlyUsd: PRICING.nbaMonthlyUsd,
    monthlyGbp: PRICING.nbaMonthlyGbp,
    monthlyEur: PRICING.nbaMonthlyEur,
    features: [FEATURES.nbaProps],
    highlights: [
      "NBA prop builder",
      "Usage & matchup edges",
      "Game-log backed rates",
    ],
    badge: "Live stats",
  },
];

export const ALL_PLAN_SLUGS = PLANS.map((p) => p.slug);

export function getPlan(slug: string): SubscriptionPlan | undefined {
  return PLANS.find((p) => p.slug === slug);
}

/** Which features a plan unlocks (full_access = everything). */
export function planIncludesFeature(
  planSlug: string,
  feature?: FeatureSlug
): boolean {
  if (!feature) return true;
  const plan = getPlan(planSlug);
  if (!plan) return false;
  if (plan.features.includes(FEATURES.fullAccess)) return true;
  return plan.features.includes(feature);
}

/** Human-readable Clerk feature names → what they gate in the app */
export const CLERK_FEATURE_GATES: Record<FeatureSlug, string> = {
  [FEATURES.footballBuilder]:
    "Bet365 builder, context mode & underpriced gems",
  [FEATURES.footballProps]:
    "Matchups, star players, team bet model (100% legs) & player H2H",
  [FEATURES.footballStats]: "Player leaderboards & prop hit rates",
  [FEATURES.racingIntel]:
    "Value naps, performance ledger, tipsters & full racecards",
  [FEATURES.racingAnalysis]: "Deep analysis & winner review panels",
  [FEATURES.nbaProps]: "NBA prop builder",
  [FEATURES.fullAccess]: "Everything across football, racing & NBA",
};

export function isSubscriptionEnabled(): boolean {
  // Require a Clerk-valid publishable key — malformed keys crash prerender.
  if (!getClerkPublishableKey()) return false;
  if (process.env.NEXT_PUBLIC_SUBSCRIPTION_ENABLED === "false") return false;
  return true;
}

/** Hub sections that require pro (path segment after competition id). */
export const GATED_HUB_SECTIONS: Record<string, FeatureSlug | "plan"> = {
  builder: FEATURES.footballBuilder,
  "star-players": FEATURES.footballProps,
  "team-model": FEATURES.footballProps,
  matches: FEATURES.footballProps,
  stats: FEATURES.footballStats,
  analysis: FEATURES.racingAnalysis,
  tipsters: FEATURES.racingIntel,
};

export function hubSectionRequiresPremium(section: string): boolean {
  return section in GATED_HUB_SECTIONS;
}
