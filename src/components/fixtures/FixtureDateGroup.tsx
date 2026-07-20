"use client";

import type { ReactNode } from "react";
import type { FixtureDateBucket } from "./groupFixtures";
import type { FixtureRowData } from "./FixtureRow";
import FixtureRow from "./FixtureRow";

export default function FixtureDateGroup({
  bucket,
  expandedId,
  onToggle,
  renderExpand,
}: {
  bucket: FixtureDateBucket<FixtureRowData>;
  expandedId: number | null;
  onToggle: (id: number) => void;
  renderExpand: (fixture: FixtureRowData) => ReactNode;
}) {
  return (
    <section>
      <div className="bg-surface-2 px-4 py-2.5 sm:px-5">
        <h3 className="text-xs font-bold tracking-wide text-muted sm:text-[13px] sm:text-foreground">
          {bucket.label}
        </h3>
      </div>
      <div>
        {bucket.fixtures.map((fx) => {
          const open = expandedId === fx.id;
          return (
            <div key={fx.id}>
              <FixtureRow
                fixture={fx}
                expanded={open}
                onToggle={() => onToggle(fx.id)}
              />
              {open && (
                <div className="fixture-expand border-b border-edge/60 bg-background/40 px-3 py-4 sm:px-5">
                  {renderExpand(fx)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
