"use client";

import { BOOKMAKERS } from "@/lib/bookmakers";
import type { BookmakerId } from "@/lib/types";

interface Props {
  enabled: BookmakerId[];
  onToggle: (id: BookmakerId) => void;
}

export default function BookmakerFilter({ enabled, onToggle }: Props) {
  const primary = BOOKMAKERS.filter((b) => b.tier === "primary");
  const extra = BOOKMAKERS.filter((b) => b.tier === "extra");

  const chip = (b: (typeof BOOKMAKERS)[number]) => {
    if (!b.available) {
      return (
        <span
          key={b.id}
          className="flex cursor-not-allowed items-center gap-1 rounded-full border border-dashed border-edge bg-surface px-3 py-1 text-xs text-muted opacity-50"
          title={b.note}
        >
          {b.name} ✕
        </span>
      );
    }
    const active = enabled.includes(b.id);
    return (
      <button
        key={b.id}
        onClick={() => onToggle(b.id)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
          active
            ? "border-transparent text-white"
            : "border-edge bg-surface text-muted line-through opacity-60 hover:opacity-90"
        }`}
        style={active ? { backgroundColor: b.color } : undefined}
        title={b.note ?? (active ? `Exclude ${b.name}` : `Include ${b.name}`)}
      >
        {b.name}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-20 shrink-0 text-xs font-medium text-muted">
          Target books:
        </span>
        {primary.map(chip)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="w-20 shrink-0 text-xs font-medium text-muted"
          title="Extra bookmakers picked up live via Oddsscanner — more books means more arbitrage windows"
        >
          Bonus books:
        </span>
        {extra.map(chip)}
      </div>
    </div>
  );
}
