"use client";

import { to24hTime } from "@/lib/horse-racing/dates";
import { useRacingSelection } from "./RacingSelectionProvider";

function shortRaceLabel(name: string): string {
  const cleaned = name
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 28) return cleaned;
  return `${cleaned.slice(0, 26).trim()}…`;
}

export default function RacingDayMeetingBar() {
  const {
    calendar,
    loading,
    selectedDate,
    setSelectedDate,
    meetings,
    selectedMeetingId,
    setSelectedMeetingId,
    races,
    selectedRaceId,
    setSelectedRaceId,
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

      {races.length > 0 && (
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:px-6">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted">
            Race time
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {races.map((race) => {
              const active = race.id === selectedRaceId;
              const time = to24hTime(race.time);
              return (
                <button
                  key={race.id}
                  type="button"
                  onClick={() => setSelectedRaceId(race.id)}
                  title={race.name}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                      : "border-edge bg-background text-muted hover:border-sky-500/30 hover:text-foreground"
                  }`}
                >
                  <span className="block text-xs font-bold tabular">{time}</span>
                  <span className="mt-0.5 block max-w-[9.5rem] truncate text-[10px] opacity-80">
                    {shortRaceLabel(race.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
