"use client";

import { useRacingSelection } from "@/components/horse-racing/RacingSelectionProvider";
import type { TipsterPick } from "@/lib/horse-racing/types";

function TipCard({ t }: { t: TipsterPick }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        t.hot
          ? "border-red-500/40 bg-red-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      }`}
    >
      <div className="flex justify-between gap-2">
        <p className="font-bold">
          {t.hot && <span className="mr-1">🔥</span>}
          {t.tipster}
        </p>
        <span className="shrink-0 text-sm font-bold text-gold tabular">
          {Math.round(t.confidence * 100)}%
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {t.trackRecord}
        {t.platform && t.platform !== "web" && ` · via ${t.platform}`}
      </p>
      <p className="mt-3 text-lg font-semibold">
        {t.matchedRunner ?? t.horse}
        {t.matchedRunner && (
          <span className="ml-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
            On today's card
          </span>
        )}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t.rationale}</p>
      {t.sourceUrl && (
        <a
          href={t.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-gold underline"
        >
          Read source →
        </a>
      )}
    </div>
  );
}

export default function TipsterIntelPage() {
  const { calendar, selectedMeeting, tipsters } = useRacingSelection();

  const general = (calendar?.tipsters ?? []).filter((t) => !t.raceId);
  const sorted = [...tipsters].sort(
    (a, b) =>
      Number(b.hot ?? false) - Number(a.hot ?? false) ||
      b.confidence - a.confidence
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Tipster intelligence</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        {selectedMeeting
          ? `Elite and insider tips for ${selectedMeeting.name} — including leaked picks from paid services shared on Reddit and Twitter.`
          : "Select a day and meeting above."}
      </p>

      {sorted.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {sorted.map((t) => (
            <TipCard key={t.id} t={t} />
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">
          {calendar?.tipsters.length
            ? "No tipster signals matched to this meeting — try Today or another course."
            : "No tipster data yet — run export with Tavily web research enabled."}
        </p>
      )}

      {general.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">
            General racing intelligence
          </h2>
          <p className="mt-1 text-xs text-muted">
            Signals not matched to a specific runner on today's cards.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {general.map((t) => (
              <TipCard key={t.id} t={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
