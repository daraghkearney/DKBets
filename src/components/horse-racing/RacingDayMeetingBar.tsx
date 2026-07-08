"use client";

import { useRacingSelection } from "./RacingSelectionProvider";

export default function RacingDayMeetingBar() {
  const {
    calendar,
    loading,
    selectedDate,
    setSelectedDate,
    meetings,
    selectedMeetingId,
    setSelectedMeetingId,
  } = useRacingSelection();

  if (loading) {
    return (
      <div className="border-b border-edge/60 bg-surface/40 px-4 py-3 sm:px-6">
        <p className="text-xs text-muted">Loading race calendar…</p>
      </div>
    );
  }

  if (!calendar?.days.length) return null;

  return (
    <div className="border-b border-edge/60 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
          Race day
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {calendar.days.map((d) => {
            const active = d.date === selectedDate;
            const hasMeetings = d.meetings.length > 0;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDate(d.date)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : hasMeetings
                      ? "border-edge bg-background text-muted hover:border-gold/30 hover:text-foreground"
                      : "border-edge/40 bg-background/40 text-muted/50"
                }`}
              >
                {d.label}
                {hasMeetings && (
                  <span className="ml-1.5 tabular opacity-70">
                    ({d.meetings.length})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
          Meeting
        </p>
        {meetings.length ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {meetings.map((m) => {
              const active = m.id === selectedMeetingId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMeetingId(m.id)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-edge bg-background text-muted hover:border-emerald-500/30 hover:text-foreground"
                  }`}
                >
                  {m.name}
                  <span className="ml-1.5 tabular opacity-70">
                    {m.races.length}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted">
            No meetings scheduled for this day.
          </p>
        )}
      </div>
    </div>
  );
}
