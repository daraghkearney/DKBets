import { basePath } from "@/lib/basePath";
import type { SportId } from "./config";

/** App routes for Next.js Link — do NOT include basePath (Next adds it). */
export function sportRoute(sport: SportId): string {
  return `/${sport}/`;
}

export function competitionRoute(sport: SportId, competition: string): string {
  return `/${sport}/${competition}/`;
}

export function hubRoute(
  sport: SportId,
  competition: string,
  section = ""
): string {
  if (!section) return `/${sport}/${competition}/`;
  const seg = section.startsWith("/") ? section : `/${section}`;
  return `/${sport}/${competition}${seg}/`;
}

/** Static JSON for a sport/competition export bundle. */
export function sportDataUrl(
  sport: SportId,
  competition: string,
  relative: string
): string {
  const path = relative.startsWith("/") ? relative : `/${relative}`;
  return `${basePath}/data/${sport}/${competition}${path}`;
}

export function isLandingPath(pathname: string): boolean {
  const p = stripBase(pathname).replace(/\/$/, "") || "/";
  if (p === "/" || p === "") return true;
  if (/^\/(football|nba|horse-racing)$/.test(p)) return true;
  return false;
}

export function parseHubPath(pathname: string): {
  sport: SportId;
  competition: string;
  section: string;
} | null {
  const p = stripBase(pathname).replace(/\/$/, "") || "/";
  const m = p.match(/^\/(football|nba|horse-racing)\/([^/]+)(?:\/(.*))?$/);
  if (!m) return null;
  return {
    sport: m[1] as SportId,
    competition: m[2],
    section: (m[3] ?? "").replace(/\/$/, ""),
  };
}

function stripBase(pathname: string): string {
  if (!basePath) return pathname || "/";
  if (pathname.startsWith(basePath)) {
    const rest = pathname.slice(basePath.length);
    return rest || "/";
  }
  return pathname || "/";
}
