"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSubscriptionEnabled } from "@/lib/subscription/config";
import AuthControls from "@/components/subscription/AuthControls";
import CurrencyToggle from "@/components/subscription/CurrencyToggle";
import PlanComparison from "@/components/subscription/PlanComparison";
import { BRAND } from "@/lib/brand";
import {
  checkoutNote,
  detectDisplayCurrency,
  type DisplayCurrency,
} from "@/lib/subscription/currency";

export default function SubscribePageClient() {
  const [currency, setCurrency] = useState<DisplayCurrency>("usd");
  const [autoDetected, setAutoDetected] = useState<DisplayCurrency | undefined>();

  useEffect(() => {
    const detected = detectDisplayCurrency();
    setCurrency(detected);
    setAutoDetected(detected);
  }, []);
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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold">
            {BRAND.name}
          </Link>
          <AuthControls />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em] text-accent">
          Pick your sport · or go all-in
        </p>
        <h1 className="mt-3 text-center text-3xl font-black tracking-tight sm:text-4xl">
          Choose your plan
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-muted">
          Football-only, racing-only, NBA props, or full all-access with
          underpriced gems, player head-to-head, the 100% team bet model and
          value naps.
        </p>

        <div className="mt-6 flex justify-center">
          <CurrencyToggle
            value={currency}
            onChange={setCurrency}
            autoDetected={autoDetected}
          />
        </div>
        <p className="mx-auto mt-3 max-w-xl text-center text-xs text-muted">
          {checkoutNote(currency)}
        </p>

        <PlanComparison currency={currency} />
      </div>
    </div>
  );
}
