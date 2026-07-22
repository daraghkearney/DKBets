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
import { courseMatchesHint, to24hTime } from "@/lib/horse-racing/dates";
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
  selectedRaceId: string | null;
  setSelectedRaceId: (id: string) => void;
  meetings: RacingMeeting[];
  selectedMeeting: RacingMeeting | null;
  /** All races at the selected meeting (ordered). */
  races: HorseRace[];
  /** Currently focused race at the meeting. */
  selectedRace: HorseRace | null;
  tipsters: TipsterPick[];
}

const RacingSelectionContext =
  createContext<RacingSelectionContextValue | null>(null);

/** Prefer the next race still to run; otherwise the first card. */
function pickDefaultRaceId(races: HorseRace[], isoDate: string): string | null {
  if (!races.length) return null;

  const now = new Date();
  const ukNow = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const part = (type: string) =>
    ukNow.find((p) => p.type === type)?.value ?? "";
  const todayUk = `${part("year")}-${part("month")}-${part("day")}`;
  const minutesNow =
    Number(part("hour")) * 60 + Number(part("minute"));

  if (isoDate === todayUk) {
    const upcoming = races.find((r) => {
      const [h, m] = to24hTime(r.time).split(":").map(Number);
      return h * 60 + m >= minutesNow - 5;
    });
    if (upcoming) return upcoming.id;
  }

  return races[0]!.id;
}

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
  const [selectedMeetingId, setSelectedMeetingIdState] = useState<string | null>(
    null
  );
  const [selectedRaceId, setSelectedRaceIdState] = useState<string | null>(
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
    setSelectedMeetingIdState(null);
    setSelectedRaceIdState(null);
  }, []);

  const setSelectedMeetingId = useCallback((id: string) => {
    setSelectedMeetingIdState(id);
    setSelectedRaceIdState(null);
  }, []);

  const setSelectedRaceId = useCallback((id: string) => {
    setSelectedRaceIdState(id);
  }, []);

  const day = useMemo(
    () => calendar?.days.find((d) => d.date === selectedDate) ?? null,
    [calendar, selectedDate]
  );

  const meetings = day?.meetings ?? [];

  useEffect(() => {
    if (!meetings.length) {
      setSelectedMeetingIdState(null);
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
        setSelectedMeetingIdState(hint.id);
        return;
      }
    }
    setSelectedMeetingIdState(meetings[0]!.id);
  }, [meetings, selectedMeetingId, defaultMeetingHint]);

  const selectedMeeting =
    meetings.find((m) => m.id === selectedMeetingId) ?? null;

  const races = selectedMeeting?.races ?? [];

  useEffect(() => {
    if (!races.length) {
      setSelectedRaceIdState(null);
      return;
    }
    if (selectedRaceId && races.some((r) => r.id === selectedRaceId)) {
      return;
    }
    setSelectedRaceIdState(pickDefaultRaceId(races, selectedDate));
  }, [races, selectedRaceId, selectedDate]);

  const selectedRace =
    races.find((r) => r.id === selectedRaceId) ?? null;

  const tipsters = useMemo(() => {
    if (!calendar?.tipsters.length || !selectedRace) return [];
    return calendar.tipsters.filter((t) => t.raceId === selectedRace.id);
  }, [calendar, selectedRace]);

  const value: RacingSelectionContextValue = {
    calendar,
    loading,
    error,
    selectedDate,
    setSelectedDate,
    selectedMeetingId,
    setSelectedMeetingId,
    selectedRaceId,
    setSelectedRaceId,
    meetings,
    selectedMeeting,
    races,
    selectedRace,
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
