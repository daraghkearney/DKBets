"use client";

import type { UnderpricedGem } from "@/lib/builder/types";
import BuilderSlipCard from "./BuilderSlipCard";

export default function UnderpricedGemCard({
  gem,
  liveOdds,
}: {
  gem: UnderpricedGem;
  liveOdds?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[#3ecf8e]/30 bg-[#126e51]/10 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#3ecf8e]">
          Why it&apos;s underpriced
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {gem.description}
        </p>
        <p className="mt-2 text-xs font-semibold text-[#3ecf8e]">
          Model edge: +{gem.edgePct.toFixed(1)} pts vs Bet365 implied probability
        </p>
      </div>
      <BuilderSlipCard slip={gem.slip} liveOdds={liveOdds} />
    </div>
  );
}
