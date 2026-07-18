"use client";

import { useEffect, useState } from "react";
import type { OddsDisplayFormat } from "@/lib/format";

const STORAGE_KEY = "statmanac-odds-format";

export function useOddsFormat(): {
  format: OddsDisplayFormat;
  setFormat: (f: OddsDisplayFormat) => void;
  toggle: () => void;
} {
  const [format, setFormatState] = useState<OddsDisplayFormat>("decimal");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "decimal" || saved === "fractional") {
        setFormatState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const setFormat = (f: OddsDisplayFormat) => {
    setFormatState(f);
    try {
      localStorage.setItem(STORAGE_KEY, f);
    } catch {
      // ignore
    }
  };

  return {
    format,
    setFormat,
    toggle: () => setFormat(format === "decimal" ? "fractional" : "decimal"),
  };
}
