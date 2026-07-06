/**
 * Base path for GitHub Pages (e.g. "/dkbets"). Empty string for root domain.
 * Set via NEXT_PUBLIC_BASE_PATH in CI.
 */
import type { StatsSampleMode } from "@/lib/stats/sample-mode";
import { DEFAULT_SAMPLE_MODE } from "@/lib/stats/sample-mode";

export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Static JSON snapshots written by scripts/export-data.ts at build time. */
export function dataUrl(relative: string): string {
  const path = relative.startsWith("/") ? relative : `/${relative}`;
  return `${basePath}/data${path}`;
}

/** Stats JSON for a selected sample mode (WC 2026, qual, last 50, etc.). */
export function sampleDataUrl(
  mode: StatsSampleMode,
  relative: string
): string {
  const path = relative.startsWith("/") ? relative : `/${relative}`;
  return `${basePath}/data/samples/${mode}${path}`;
}

export function sampleManifestUrl(): string {
  return `${basePath}/data/sample-manifest.json`;
}

export { DEFAULT_SAMPLE_MODE };
