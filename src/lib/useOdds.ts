"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dataUrl } from "./basePath";
import type { OddsSnapshot } from "./types";

export interface UseOddsResult {
  snapshot: OddsSnapshot | null;
  error: boolean;
  refreshing: boolean;
  lastUpdated: Date | null;
  secondsToRefresh: number;
  refresh: () => void;
}

/** Loads static odds snapshot (refreshed on each GitHub Pages deploy). */
export function useOdds(_intervalMs = 10_000): UseOddsResult {
  const [snapshot, setSnapshot] = useState<OddsSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsToRefresh, setSecondsToRefresh] = useState(0);
  const nextAt = useRef<number>(Date.now());
  const fetching = useRef(false);

  const load = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setRefreshing(true);
    try {
      const res = await fetch(dataUrl("/odds.json"), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OddsSnapshot & { exportedAt?: string } = await res.json();
      setSnapshot(data);
      setLastUpdated(
        data.exportedAt ? new Date(data.exportedAt) : new Date()
      );
      setError(false);
    } catch {
      setError(true);
    } finally {
      fetching.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    snapshot,
    error,
    refreshing,
    lastUpdated,
    secondsToRefresh,
    refresh: load,
  };
}
