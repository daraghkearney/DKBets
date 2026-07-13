"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { sampleDataUrl } from "@/lib/basePath";
import {
  DEFAULT_SAMPLE_MODE,
  SAMPLE_MODES,
  type StatsSampleMode,
  isStatsSampleMode,
} from "@/lib/stats/sample-mode";

const STORAGE_KEY = "statmanac-stats-sample-mode";

interface SampleModeContextValue {
  mode: StatsSampleMode;
  setMode: (mode: StatsSampleMode) => void;
  sampleUrl: (relative: string) => string;
  options: typeof SAMPLE_MODES;
}

const SampleModeContext = createContext<SampleModeContextValue | null>(null);

export function SampleModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<StatsSampleMode>(DEFAULT_SAMPLE_MODE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && isStatsSampleMode(saved)) setModeState(saved);
    } catch {
      /* private browsing */
    }
    setReady(true);
  }, []);

  const setMode = useCallback((next: StatsSampleMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      sampleUrl: (relative: string) => sampleDataUrl(mode, relative),
      options: SAMPLE_MODES,
    }),
    [mode, setMode]
  );

  if (!ready) {
    return (
      <SampleModeContext.Provider value={value}>
        {children}
      </SampleModeContext.Provider>
    );
  }

  return (
    <SampleModeContext.Provider value={value}>
      {children}
    </SampleModeContext.Provider>
  );
}

export function useSampleMode(): SampleModeContextValue {
  const ctx = useContext(SampleModeContext);
  if (!ctx) {
    throw new Error("useSampleMode must be used within SampleModeProvider");
  }
  return ctx;
}
