"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
} from "@clerk/clerk-react";
import {
  CheckoutButton,
  usePlans,
} from "@clerk/clerk-react/experimental";
import {
  PLANS,
  PRICING,
  type SubscriptionPlan,
} from "@/lib/subscription/config";
import {
  formatDisplayPrice,
  getPlanDisplayPrices,
  type DisplayCurrency,
} from "@/lib/subscription/currency";

function PlanSubscribeButton({
  planId,
  planPeriod = "month",
  trialDays,
  label,
}: {
  planId: string;
  planPeriod?: "month" | "annual";
  trialDays?: number | null;
  label: string;
}) {
  const cta =
    trialDays && trialDays > 0
      ? `Start ${trialDays}-day free trial`
      : "Subscribe";

  return (
    <>
      <SignedOut>
        <SignUpButton mode="redirect" forceRedirectUrl="/subscribe/">
          <button
            type="button"
            className="w-full rounded-xl border border-edge bg-surface/80 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/40"
          >
            Sign up to subscribe
          </button>
        </SignUpButton>
        <p className="mt-2 text-center text-[11px] text-muted">
          Already have an account?{" "}
          <SignInButton mode="redirect" forceRedirectUrl="/subscribe/">
            <button type="button" className="text-accent underline">
              Sign in
            </button>
          </SignInButton>
        </p>
      </SignedOut>
      <SignedIn>
        <CheckoutButton
          planId={planId}
          planPeriod={planPeriod}
          newSubscriptionRedirectUrl="/"
        >
          <button
            type="button"
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
          >
            {label || cta}
          </button>
        </CheckoutButton>
      </SignedIn>
    </>
  );
}

function PlanCard({
  plan,
  clerkPlan,
  currency,
}: {
  plan: SubscriptionPlan;
  currency: DisplayCurrency;
  clerkPlan?: {
    id: string;
    fee: { amount: number };
    annualMonthlyFee: { amount: number } | null;
    freeTrialDays: number | null;
    features: { name: string; slug: string }[];
  };
}) {
  const hasAnnual = Boolean(plan.annualUsd && clerkPlan?.annualMonthlyFee);
  const [annual, setAnnual] = useState(false);

  const clerkMonthlyUsd =
    clerkPlan?.fee?.amount != null ? clerkPlan.fee.amount / 100 : undefined;
  const clerkAnnualMonthlyUsd =
    clerkPlan?.annualMonthlyFee?.amount != null
      ? clerkPlan.annualMonthlyFee.amount / 100
      : undefined;

  const prices = getPlanDisplayPrices(plan, currency, {
    clerkMonthlyUsd,
    clerkAnnualMonthlyUsd,
  });

  const displayPrice =
    annual && prices.annualMonthly != null
      ? prices.annualMonthly
      : prices.monthly;

  const fmt = (n: number) => formatDisplayPrice(n, currency);

  const clerkFeatures =
    clerkPlan?.features?.map((f) => f.name) ??
    plan.features.map((slug) => slug.replace(/_/g, " "));

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 ${
        plan.recommended
          ? "border-accent/50 bg-accent/5 shadow-[0_0_40px_rgba(34,197,94,0.08)]"
          : "border-edge/60 bg-surface/40"
      }`}
    >
      {plan.badge && (
        <span
          className={`absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            plan.recommended
              ? "bg-accent text-background"
              : "bg-gold/20 text-gold"
          }`}
        >
          {plan.badge}
        </span>
      )}

      <h3 className="text-lg font-bold">{plan.name}</h3>
      <p className="mt-1 text-xs text-muted">{plan.tagline}</p>

      <div className="mt-4">
        <p>
          <span className="text-2xl font-black">{fmt(displayPrice)}</span>
          <span className="text-sm text-muted">/mo</span>
        </p>
        {annual && prices.annual != null && (
          <p className="mt-1 text-xs text-muted">
            {fmt(prices.annual)} billed annually
          </p>
        )}
        {!annual && prices.annual != null && prices.annualMonthly != null && (
          <p className="mt-1 text-xs text-muted">
            or {fmt(prices.annual)}/yr ({fmt(prices.annualMonthly)}/mo)
          </p>
        )}
      </div>

      {hasAnnual && (
        <div className="mt-3 flex rounded-lg border border-edge/60 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`flex-1 rounded-md px-2 py-1.5 font-semibold transition-colors ${
              !annual ? "bg-accent/20 text-accent" : "text-muted"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`flex-1 rounded-md px-2 py-1.5 font-semibold transition-colors ${
              annual ? "bg-accent/20 text-accent" : "text-muted"
            }`}
          >
            Annual
          </button>
        </div>
      )}

      <ul className="mt-4 flex-1 space-y-1.5 text-xs text-muted">
        {plan.highlights.map((h) => (
          <li key={h} className="flex gap-2">
            <span className="text-accent">✓</span>
            {h}
          </li>
        ))}
      </ul>

      {clerkFeatures.length > 0 && (
        <div className="mt-4 border-t border-edge/40 pt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Includes
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-muted">
            {clerkFeatures.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        {clerkPlan ? (
          <PlanSubscribeButton
            planId={clerkPlan.id}
            planPeriod={annual ? "annual" : "month"}
            trialDays={clerkPlan.freeTrialDays}
            label={
              clerkPlan.freeTrialDays
                ? `Start ${clerkPlan.freeTrialDays}-day free trial`
                : "Subscribe"
            }
          />
        ) : (
          <p className="rounded-lg border border-edge/60 bg-surface/60 px-3 py-2 text-center text-xs text-muted">
            Plan not found in Clerk — create slug{" "}
            <code className="text-accent">{plan.slug}</code>
          </p>
        )}
      </div>
    </div>
  );
}

function BillingSetupPrompt() {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
        Billing setup required
      </p>
      <h2 className="mt-3 text-lg font-bold">Enable Clerk Billing</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Create your plans in Clerk Dashboard under{" "}
        <strong>Plans for Users</strong>. Annual price = monthly equivalent (
        e.g. ${PRICING.proAnnualMonthlyUsd}/mo, not $
        {PRICING.proAnnualUsd} total).
      </p>
      <a
        href="https://dashboard.clerk.com/last-active?path=billing/plans"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-background"
      >
        Open Clerk Billing →
      </a>
    </div>
  );
}

export default function PlanComparison({
  currency,
}: {
  currency: DisplayCurrency;
}) {
  const { data: clerkPlans, isLoading, error } = usePlans();

  const planBySlug = useMemo(() => {
    const map = new Map<string, (typeof clerkPlans)[number]>();
    for (const p of clerkPlans ?? []) {
      if (p.slug && p.publiclyVisible && !p.isDefault) {
        map.set(p.slug, p);
      }
    }
    return map;
  }, [clerkPlans]);

  if (error?.message?.includes("billing is disabled")) {
    return <BillingSetupPrompt />;
  }

  if (isLoading) {
    return (
      <div className="mt-12 flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge border-t-accent" />
      </div>
    );
  }

  const paidPlans = PLANS.filter((p) => planBySlug.has(p.slug));
  const missingPlans = PLANS.filter((p) => !planBySlug.has(p.slug));

  return (
    <div className="mt-12">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.slug}
            plan={plan}
            currency={currency}
            clerkPlan={planBySlug.get(plan.slug)}
          />
        ))}
      </div>

      {paidPlans.length === 0 && (
        <BillingSetupPrompt />
      )}

      {missingPlans.length > 0 && paidPlans.length > 0 && (
        <p className="mt-6 text-center text-xs text-muted">
          Missing in Clerk:{" "}
          {missingPlans.map((p) => p.slug).join(", ")} — cards show setup hint
          until created.
        </p>
      )}

      <p className="mt-8 text-center text-xs text-muted">
        {PRICING.trialDays}-day trial on eligible plans · Cancel anytime in your
        account ·{" "}
        <Link href="/" className="text-accent underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
