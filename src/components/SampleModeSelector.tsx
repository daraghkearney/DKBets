"use client";

import { useSampleMode } from "@/components/SampleModeProvider";

export default function SampleModeSelector() {
  const { mode, setMode, options } = useSampleMode();

  return (
    <div className="border-b border-edge bg-surface/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Stats sample
          </p>
          <p className="text-xs text-muted">
            Hit rates and models use the selected dataset across all sections.
          </p>
        </div>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className="w-full max-w-md rounded-xl border border-edge bg-background px-3 py-2 text-sm font-medium sm:w-auto"
          aria-label="Stats sample mode"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
