"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { sportDataUrl } from "@/lib/sports/paths";
import { courseMatchesHint } from "@/lib/horse-racing/dates";
import type {
  RacingCalendarPayload,
  RacingMeeting,
  HorseRace,
  TipsterPick,
} from "@/lib/horse-racing/types";

interface RacingSelectionContextValue {
  calendar: RacingCalendarPayload | null;
  loading: boolean;
  error: boolean;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedMeetingId: string | null;
  setSelectedMeetingId: (id: string) => void;
  meetings: RacingMeeting[];
  selectedMeeting: RacingMeeting | null;
  races: HorseRace[];
  tipsters: TipsterPick[];
}

const RacingSelectionContext =
  createContext<RacingSelectionContextValue | null>(null);

export function RacingSelectionProvider({
  children,
  defaultMeetingHint,
}: {
  children: React.ReactNode;
  defaultMeetingHint?: string;
}) {
  const [calendar, setCalendar] = useState<RacingCalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedDate, setSelectedDateState] = useState<string>("");
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    null
  );

  useEffect(() => {
    fetch(sportDataUrl("horse-racing", "todays-races", "/calendar.json"), {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: RacingCalendarPayload) => {
        setCalendar(data);
        const first = data.days[0]?.date ?? "";
        setSelectedDateState(first);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
    setSelectedMeetingId(null);
  }, []);

  const day = useMemo(
    () => calendar?.days.find((d) => d.date === selectedDate) ?? null,
    [calendar, selectedDate]
  );

  const meetings = day?.meetings ?? [];

  useEffect(() => {
    if (!meetings.length) {
      setSelectedMeetingId(null);
      return;
    }
    if (
      selectedMeetingId &&
      meetings.some((m) => m.id === selectedMeetingId)
    ) {
      return;
    }
    if (defaultMeetingHint) {
      const hint = meetings.find((m) =>
        courseMatchesHint(m.name, defaultMeetingHint)
      );
      if (hint) {
        setSelectedMeetingId(hint.id);
        return;
      }
    }
    setSelectedMeetingId(meetings[0].id);
  }, [meetings, selectedMeetingId, defaultMeetingHint]);

  const selectedMeeting =
    meetings.find((m) => m.id === selectedMeetingId) ?? null;

  const races = selectedMeeting?.races ?? [];

  const tipsters = useMemo(() => {
    if (!calendar?.tipsters.length || !races.length) return [];
    const raceIds = new Set(races.map((r) => r.id));
    return calendar.tipsters.filter((t) => raceIds.has(t.raceId));
  }, [calendar, races]);

  const value: RacingSelectionContextValue = {
    calendar,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    selectedMeetingId,
    setSelectedMeetingId,
    meetings,
    selectedMeeting,
    races,
    tipsters,
  };

  return (
    <RacingSelectionContext.Provider value={value}>
      {children}
    </RacingSelectionContext.Provider>
  );
}

export function useRacingSelection(): RacingSelectionContextValue {
  const ctx = useContext(RacingSelectionContext);
  if (!ctx) {
    throw new Error(
      "useRacingSelection must be used within RacingSelectionProvider"
    );
  }
  return ctx;
}
