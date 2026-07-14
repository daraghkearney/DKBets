import { PRICING, PRO_PLAN_SLUG, type SubscriptionPlan } from "./config";

export type DisplayCurrency = "usd" | "gbp" | "eur";

const EUR_LOCALES = new Set([
  "ie",
  "de",
  "fr",
  "es",
  "it",
  "nl",
  "pt",
  "at",
  "be",
  "fi",
  "gr",
  "lu",
  "mt",
  "cy",
  "sk",
  "si",
  "ee",
  "lv",
  "lt",
]);

/** Guess display currency from browser locale (client-only). */
export function detectDisplayCurrency(): DisplayCurrency {
  if (typeof navigator === "undefined") return "usd";

  const tags = [
    navigator.language,
    ...(navigator.languages ?? []),
  ].map((t) => t.toLowerCase());

  for (const tag of tags) {
    if (tag.endsWith("-gb") || tag === "en-gb") return "gbp";
  }
  for (const tag of tags) {
    const base = tag.split("-")[0];
    if (tag.endsWith("-ie") || base === "ie") return "eur";
    if (EUR_LOCALES.has(base)) return "eur";
  }

  return "usd";
}

const SYMBOL: Record<DisplayCurrency, string> = {
  usd: "$",
  gbp: "£",
  eur: "€",
};

export function formatDisplayPrice(
  amount: number,
  currency: DisplayCurrency
): string {
  const sym = SYMBOL[currency];
  const formatted = amount % 1 === 0 ? String(amount) : amount.toFixed(2);
  return `${sym}${formatted}`;
}

export function currencyLabel(currency: DisplayCurrency): string {
  return { usd: "USD", gbp: "GBP", eur: "EUR" }[currency];
}

export interface PlanDisplayPrices {
  monthly: number;
  annual?: number;
  annualMonthly?: number;
}

export function getPlanDisplayPrices(
  plan: SubscriptionPlan,
  currency: DisplayCurrency,
  opts?: {
    clerkMonthlyUsd?: number;
    clerkAnnualMonthlyUsd?: number;
  }
): PlanDisplayPrices {
  if (currency === "usd") {
    const annualMonthly =
      plan.slug === PRO_PLAN_SLUG
        ? (opts?.clerkAnnualMonthlyUsd ?? PRICING.proAnnualMonthlyUsd)
        : plan.annualUsd
          ? plan.annualUsd / 12
          : undefined;
    return {
      monthly: opts?.clerkMonthlyUsd ?? plan.monthlyUsd,
      annual: plan.annualUsd,
      annualMonthly,
    };
  }

  if (currency === "gbp") {
    return {
      monthly: plan.monthlyGbp,
      annual: plan.annualGbp,
      annualMonthly: plan.annualMonthlyGbp,
    };
  }

  return {
    monthly: plan.monthlyEur,
    annual: plan.annualEur,
    annualMonthly: plan.annualMonthlyEur,
  };
}

export function checkoutNote(currency: DisplayCurrency): string {
  if (currency === "usd") {
    return "Billed in USD via Stripe.";
  }
  return `Prices shown in ${currencyLabel(currency)} for convenience — charged in USD via Stripe at checkout.`;
}
