"use client";

import Link from "next/link";
import { PRICING } from "@/lib/subscription/config";
import { BRAND } from "@/lib/brand";
import type { FeatureSlug } from "@/lib/subscription/config";

const FEATURE_COPY: Partial<Record<FeatureSlug, string>> = {
  football_builder:
    "Bet365 builder slips plus underpriced gems — standout value picks with an incredibly high hit rate.",
  football_props:
    "Positional matchups, player head-to-head duels, star-player props and the team bet model built from 100% hit-rate legs.",
  football_stats:
    "Full player leaderboards, H2H hit rates and prop breakdowns across every matchup.",
  racing_intel: "Elite tipster league feeds, OLBG consensus and red-hot naps.",
  racing_analysis: "13-factor model scores, value edges and deep form analysis.",
  nba_props: "NBA prop models and builder legs (when live).",
  full_access:
    "Underpriced gems, player H2H, 100% team bet model, racing naps and everything else.",
};

export default function UpgradePrompt({
  feature,
  compact = false,
}: {
  feature?: FeatureSlug;
  compact?: boolean;
}) {
  const blurb =
    (feature && FEATURE_COPY[feature]) ??
    "Unlock underpriced gems, player head-to-head, the 100% team bet model, value naps and tipster intelligence.";

  if (compact) {
    return (
      <p className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted">
        <span className="font-semibold text-gold">{BRAND.proName}</span> — {blurb}{" "}
        <Link href="/subscribe/" className="font-bold text-accent underline">
          Subscribe →
        </Link>
      </p>
    );
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-gold/40 bg-gradient-to-b from-gold/10 to-transparent p-8 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
        {BRAND.proName}
      </p>
      <h2 className="mt-3 text-2xl font-bold">Upgrade to unlock</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{blurb}</p>
      <ul className="mt-5 space-y-2 text-left text-sm text-muted">
        {[
          "Underpriced gems — incredibly high hit-rate value picks",
          "Player head-to-head duels with career H2H stats",
          "Team bet model — 100% hit-rate props, bankers & extended accas",
          "Horse racing value naps, 13-factor model & tipster intel",
          "NBA props (as pipelines go live)",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-gold">✓</span>
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted">
        Football from £{PRICING.footballMonthlyGbp}/mo · Racing from £
        {PRICING.racingMonthlyGbp}/mo · All-access from £
        {PRICING.proMonthlyGbp}/mo · {PRICING.trialDays}-day free trial
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/subscribe/"
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
        >
          View plans
        </Link>
        <Link
          href="/sign-in/"
          className="rounded-xl border border-edge px-6 py-2.5 text-sm font-semibold text-muted hover:text-foreground"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
