"use client";

import type { DisplayCurrency } from "@/lib/subscription/currency";
import { currencyLabel } from "@/lib/subscription/currency";

const OPTIONS: DisplayCurrency[] = ["gbp", "eur", "usd"];

export default function CurrencyToggle({
  value,
  onChange,
  autoDetected,
}: {
  value: DisplayCurrency;
  onChange: (c: DisplayCurrency) => void;
  autoDetected?: DisplayCurrency;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="inline-flex rounded-full border border-edge/70 bg-surface/60 p-1"
        role="group"
        aria-label="Display currency"
      >
        {OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-pressed={value === c}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
              value === c
                ? "bg-accent/20 text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {currencyLabel(c)}
            {autoDetected === c ? (
              <span className="ml-1 text-[10px] font-normal opacity-70">
                · auto
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
