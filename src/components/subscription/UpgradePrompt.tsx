"use client";

import Link from "next/link";
import { PRICING } from "@/lib/subscription/config";
import type { FeatureSlug } from "@/lib/subscription/config";

const FEATURE_COPY: Partial<Record<FeatureSlug, string>> = {
  football_builder:
    "Bet365 builder slips, context research and underpriced gems for World Cup fixtures.",
  football_props:
    "Star-player props, team models and calibrated banker slips.",
  football_stats: "Full player leaderboards, hit rates and prop breakdowns.",
  racing_intel: "Elite tipster league feeds, OLBG consensus and red-hot naps.",
  racing_analysis: "13-factor model scores, value edges and deep form analysis.",
  nba_props: "NBA prop models and builder legs (when live).",
  full_access: "Everything across football, horse racing and NBA.",
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
    "Unlock multi-sport models, builders, value naps and tipster intelligence.";

  if (compact) {
    return (
      <p className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-muted">
        <span className="font-semibold text-gold">Pro</span> — {blurb}{" "}
        <Link href="/subscribe/" className="font-bold text-accent underline">
          Subscribe →
        </Link>
      </p>
    );
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-gold/40 bg-gradient-to-b from-gold/10 to-transparent p-8 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
        DKBets Pro
      </p>
      <h2 className="mt-3 text-2xl font-bold">Upgrade to unlock</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{blurb}</p>
      <ul className="mt-5 space-y-2 text-left text-sm text-muted">
        {[
          "Football Bet365 builder + star players + team models",
          "Horse racing value naps, 13-factor model & tipster intel",
          "NBA props (as pipelines go live)",
          "Performance ledger & verified track record",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-gold">✓</span>
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted">
        From{" "}
        <span className="font-bold text-foreground">
          £{PRICING.introMonthlyGbp}
        </span>{" "}
        intro · then £{PRICING.proMonthlyGbp}/mo · {PRICING.trialDays}-day
        trial via Clerk
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
