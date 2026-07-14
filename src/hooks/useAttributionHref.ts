"use client";

import { useMemo } from "react";
import {
  getStoredAttribution,
  parseAttributionFromSearch,
  withAttribution,
} from "@/lib/marketing/attribution";

/** Internal link href with URL + persisted UTM/ref params attached. */
export function useAttributionHref(path: string): string {
  return useMemo(() => {
    if (typeof window === "undefined") return path;
    const fromUrl = parseAttributionFromSearch(
      window.location.search,
      window.location.pathname
    );
    const stored = getStoredAttribution();
    return withAttribution(path, { ...stored, ...fromUrl });
  }, [path]);
}
