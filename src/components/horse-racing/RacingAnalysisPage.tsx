"use client";

import { useRacingSelection } from "@/components/horse-racing/RacingSelectionProvider";

export default function RacingAnalysisPage() {
  const { selectedMeeting, selectedRace } = useRacingSelection();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Deep race analysis</h1>
      <p className="mt-2 text-sm text-muted">
        {selectedMeeting && selectedRace
          ? `${selectedMeeting.name} ${selectedRace.time} — distance suitability, course history and recent form.`
          : selectedMeeting
            ? `${selectedMeeting.name} — select a race time above.`
            : "Select a day, meeting and race time above."}
      </p>

      {selectedRace ? (
        <section className="mt-8">
          <h2 className="text-lg font-bold">
            {selectedRace.time} · {selectedRace.name}
          </h2>
          <div className="mt-3 grid gap-2">
            {[...selectedRace.runners]
              .sort((a, b) => b.overallScore - a.overallScore)
              .map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-edge bg-surface px-4 py-3"
                >
                  <div className="flex justify-between">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-sm font-bold text-gold tabular">
                      {Math.round(r.overallScore * 100)}% fit
                    </p>
                  </div>
                  <ul className="mt-1 text-xs text-muted">
                    {r.notes.map((n) => (
                      <li key={n}>· {n}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
