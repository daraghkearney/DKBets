"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PricingTable } from "@clerk/clerk-react";
import { isSubscriptionEnabled, PRICING } from "@/lib/subscription/config";
import AuthControls from "@/components/subscription/AuthControls";

export default function SubscribePageClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isSubscriptionEnabled()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Subscriptions coming soon</h1>
        <p className="mt-3 text-sm text-muted">
          Enable Clerk billing in your environment to activate plans. See{" "}
          <code className="text-xs">docs/SUBSCRIPTION.md</code>.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-accent underline">
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold">
            DKBets
          </Link>
          <AuthControls />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
          All-access · Multi-sport
        </p>
        <h1 className="mt-3 text-center text-3xl font-black tracking-tight sm:text-4xl">
          DKBets Pro
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-muted">
          Football builders, World Cup props, horse racing value naps, learned
          model scores and tipster intel — one subscription across every sport.
        </p>

        <div className="mt-10 flex justify-center">
          {mounted ? <PricingTable /> : <p className="text-sm text-muted">Loading plans…</p>}
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          Intro £{PRICING.introMonthlyGbp}/mo · Standard £{PRICING.proMonthlyGbp}
          /mo · Annual £{PRICING.proAnnualGbp}/yr · Cancel anytime in your account
        </p>
      </div>
    </div>
  );
}
