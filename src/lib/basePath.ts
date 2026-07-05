/**
 * Base path for GitHub Pages (e.g. "/dkbets"). Empty string for root domain.
 * Set via NEXT_PUBLIC_BASE_PATH in CI.
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Static JSON snapshots written by scripts/export-data.ts at build time. */
export function dataUrl(relative: string): string {
  const path = relative.startsWith("/") ? relative : `/${relative}`;
  return `${basePath}/data${path}`;
}
