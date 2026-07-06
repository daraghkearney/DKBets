"use client";

import { useState } from "react";
import { formatKickoff, formatPct } from "@/lib/format";
import {
  bet365LegLinkLabel,
  bet365LinkHint,
  bet365LinkLabel,
  buildBet365SlipLink,
  resolveBet365LegLink,
} from "@/lib/builder/bet365-links";
import type { BuilderSlip } from "@/lib/builder/types";

export default function BuilderSlipCard({
  slip,
  highlight,
  liveOdds,
}: {
  slip: BuilderSlip;
  highlight?: boolean;
  liveOdds?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const liveLegCount = slip.legs.filter((l) => l.oddsSource === "bet365_live").length;
  const bet365Link = buildBet365SlipLink(slip);

  async function copyLink() {
    if (!bet365Link) return;
    try {
      await navigator.clipboard.writeText(bet365Link.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-gold/50 bg-gradient-to-br from-gold/10 to-surface"
          : "border-[#126e51]/30 bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#3ecf8e]">
            {slip.targetLabel ?? "Bet365 Bet Builder"}
          </p>
          <h3 className="text-lg font-bold">{slip.title}</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular text-[#3ecf8e]">
            {slip.combinedFractional}
          </p>
          <p className="text-xs text-muted">
            {slip.combinedDecimal.toFixed(2)} decimal · Bet365
          </p>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted">
        Combined probability{" "}
        <strong className="text-foreground">
          {formatPct(slip.combinedProbability, 1)}
        </strong>{" "}
        · {slip.legs.length} leg{slip.legs.length === 1 ? "" : "s"}
        {liveOdds && liveLegCount > 0 && (
          <>
            {" "}
            · {liveLegCount} live Bet365 price
            {liveLegCount === 1 ? "" : "s"}
          </>
        )}
      </p>

      {bet365Link && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={bet365Link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#126e51] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            {bet365LinkLabel(bet365Link)}
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-xl border border-[#126e51]/40 px-4 py-2.5 text-sm font-semibold text-[#3ecf8e] transition-colors hover:border-[#126e51]"
          >
            {copied ? "Copied!" : "Copy Bet365 link"}
          </button>
          <p className="w-full text-[11px] text-muted">{bet365LinkHint(bet365Link)}</p>
        </div>
      )}

      <ol className="mt-4 flex flex-col gap-2">
        {slip.legs.map((leg, i) => {
          const legLink = resolveBet365LegLink(leg);
          return (
          <li
            key={leg.id}
            className="rounded-xl border border-edge bg-background/40 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#3ecf8e]">
                  Leg {i + 1}
                  {leg.oddsSource === "bet365_live" && (
                    <span className="ml-1.5 text-gold">live</span>
                  )}
                </p>
                <p className="font-semibold">{leg.market}</p>
                <p className="text-xs text-muted">
                  {leg.matchLabel} · {formatKickoff(leg.kickoff)} UTC
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="tabular font-bold">{leg.fractionalOdds}</p>
                <p className="text-muted">{formatPct(leg.hitRate, 0)} hit rate</p>
                {legLink && (
                  <a
                    href={legLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[#3ecf8e] underline"
                  >
                    {bet365LegLinkLabel(legLink)}
                  </a>
                )}
              </div>
            </div>
          </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[11px] text-muted">
        Bet365 live odds via odds-api.io. Selections from tournament + career
        H2H stats. Not affiliated with Bet365. Gamble responsibly.
      </p>
    </div>
  );
}
