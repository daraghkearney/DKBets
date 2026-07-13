"use client";

import { useEffect, useMemo, useState } from "react";
import { buildStakePlan } from "@/lib/arb";
import { BOOKMAKER_MAP } from "@/lib/bookmakers";
import {
  CURRENCY_SYMBOL,
  formatKickoff,
  formatMoney,
  formatOdds,
  formatPct,
  type Currency,
  type OddsFormat,
} from "@/lib/format";
import type { ArbOpportunity } from "@/lib/types";
import { BRAND } from "@/lib/brand";

interface Props {
  arb: ArbOpportunity | null;
  currency: Currency;
  oddsFormat: OddsFormat;
  onClose: () => void;
}

const ROUND_OPTIONS = [
  { value: 0, label: "Exact (pennies)" },
  { value: 0.5, label: "Nearest 50p" },
  { value: 1, label: "Nearest £1 / €1" },
  { value: 5, label: "Nearest £5 / €5" },
];

export default function StakeCalculator({
  arb,
  currency,
  oddsFormat,
  onClose,
}: Props) {
  const [totalStake, setTotalStake] = useState(100);
  const [roundTo, setRoundTo] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [arb, totalStake, roundTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const plan = useMemo(
    () => (arb ? buildStakePlan(arb.legs, totalStake, roundTo) : null),
    [arb, totalStake, roundTo]
  );

  if (!arb || !plan) return null;

  const sym = CURRENCY_SYMBOL[currency];

  const copySlip = async () => {
    const lines = [
      `${BRAND.name} arb — ${arb.matchLabel} · ${arb.marketName}`,
      ...plan.legs.map(
        (l) =>
          `${BOOKMAKER_MAP[l.bookmaker].name}: ${formatMoney(
            l.stake,
            currency
          )} on "${l.outcomeLabel}" @ ${l.odds.toFixed(2)} → returns ${formatMoney(
            l.payout,
            currency
          )}`
      ),
      `Total staked: ${formatMoney(plan.totalStaked, currency)}`,
      `Guaranteed profit: ${formatMoney(
        plan.guaranteedProfit,
        currency
      )} (${formatPct(plan.roiPct)})`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-edge bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-edge bg-surface px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Stake Splitter</h3>
            <p className="text-xs text-muted">
              {arb.homeFlag} {arb.matchLabel} {arb.awayFlag} · {arb.marketName}{" "}
              · {formatKickoff(arb.kickoff)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-edge px-2.5 py-1 text-sm text-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Total stake
              </span>
              <div className="flex items-center rounded-xl border border-edge bg-surface-2 focus-within:border-accent/60">
                <span className="pl-3 text-lg font-bold text-muted">{sym}</span>
                <input
                  type="number"
                  min={1}
                  step={5}
                  value={totalStake}
                  onChange={(e) =>
                    setTotalStake(Math.max(0, Number(e.target.value)))
                  }
                  className="w-full bg-transparent px-2 py-2.5 text-lg font-bold outline-none"
                />
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {[25, 50, 100, 250, 500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTotalStake(v)}
                    className={`rounded-md border px-2 py-0.5 text-[11px] ${
                      totalStake === v
                        ? "border-accent/60 bg-accent/15 text-accent"
                        : "border-edge text-muted hover:text-foreground"
                    }`}
                  >
                    {sym}
                    {v}
                  </button>
                ))}
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Round stakes to
              </span>
              <select
                value={roundTo}
                onChange={(e) => setRoundTo(Number(e.target.value))}
                className="w-full rounded-xl border border-edge bg-surface-2 px-3 py-3 text-sm outline-none focus:border-accent/60"
              >
                {ROUND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-muted">
                Rounded stakes look natural to bookmakers and reduce account
                restriction risk. Profit shown is the worst case after
                rounding.
              </p>
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-edge">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-3 py-2.5">Place at</th>
                  <th className="px-3 py-2.5">Outcome</th>
                  <th className="px-3 py-2.5 text-right">Odds</th>
                  <th className="px-3 py-2.5 text-right">Stake</th>
                  <th className="px-3 py-2.5 text-right">Returns</th>
                </tr>
              </thead>
              <tbody>
                {plan.legs.map((leg) => {
                  const b = BOOKMAKER_MAP[leg.bookmaker];
                  return (
                    <tr key={leg.outcomeKey} className="border-t border-edge/60">
                      <td className="px-3 py-3">
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold"
                          style={{ backgroundColor: b.color, color: b.textColor }}
                        >
                          {b.name} ↗
                        </a>
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {leg.outcomeLabel}
                      </td>
                      <td className="tabular px-3 py-3 text-right">
                        {formatOdds(leg.odds, oddsFormat)}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-base font-bold text-accent">
                        {formatMoney(leg.stake, currency)}
                      </td>
                      <td className="tabular px-3 py-3 text-right text-muted">
                        {formatMoney(leg.payout, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total staked" value={formatMoney(plan.totalStaked, currency)} />
            <Stat
              label="Guaranteed profit"
              value={formatMoney(plan.guaranteedProfit, currency)}
              accent={plan.guaranteedProfit >= 0 ? "green" : "red"}
            />
            <Stat
              label="Return on stake"
              value={formatPct(plan.roiPct)}
              accent={plan.roiPct >= 0 ? "green" : "red"}
            />
            <Stat
              label="Best-case profit"
              value={formatMoney(plan.maxProfit, currency)}
            />
          </div>

          {plan.guaranteedProfit < 0 && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              Rounding at this stake size has eaten the edge — the worst-case
              outcome is now a small loss. Use a larger total stake or switch
              to exact stakes.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm text-[11px] leading-relaxed text-muted">
              Whichever outcome wins, the winning bookmaker pays out ≈
              {formatMoney(plan.minPayout, currency)}, more than your{" "}
              {formatMoney(plan.totalStaked, currency)} total outlay. Place all
              legs quickly — prices can move between bets.
            </p>
            <button
              onClick={copySlip}
              className="rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
            >
              {copied ? "Copied ✓" : "Copy bet slip"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red";
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`tabular text-lg font-bold ${
          accent === "green"
            ? "text-accent"
            : accent === "red"
              ? "text-red-400"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
