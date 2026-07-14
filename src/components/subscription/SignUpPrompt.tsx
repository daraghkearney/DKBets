"use client";

import Link from "next/link";
import { SignUpButton } from "@clerk/clerk-react";
import { formatWorldCupFreeEndLabel } from "@/lib/marketing/world-cup-promo";
import { BRAND } from "@/lib/brand";

export default function SignUpPrompt({
  compact = false,
}: {
  compact?: boolean;
}) {
  const endLabel = formatWorldCupFreeEndLabel();

  if (compact) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-muted">
        <span className="font-semibold text-emerald-300">Free World Cup access</span>
        {" — "}
        sign up to unlock builders, star players and matchups
        {endLabel ? ` until ${endLabel}` : ""}.{" "}
        <SignUpButton mode="modal">
          <button
            type="button"
            className="font-bold text-accent underline"
          >
            Sign up free →
          </button>
        </SignUpButton>
      </p>
    );
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-emerald-500/35 bg-gradient-to-b from-emerald-500/10 to-transparent p-8 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
        World Cup launch
      </p>
      <h2 className="mt-3 text-2xl font-bold">Sign up free</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Create a free {BRAND.name} account to access the full World Cup toolkit —
        Bet365 builders, star player specials, positional matchups and player
        stats
        {endLabel ? ` until ${endLabel}` : ""}. No card required during the
        promo.
      </p>
      <ul className="mt-5 space-y-2 text-left text-sm text-muted">
        {[
          "Bet365 builder with model hit-rates",
          "Star player props & standout gem stats",
          "Positional matchups & career head-to-head",
          "Full player leaderboards",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-emerald-300">✓</span>
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <SignUpButton mode="modal">
          <button
            type="button"
            className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
          >
            Create free account
          </button>
        </SignUpButton>
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
