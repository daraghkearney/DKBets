import { basePath } from "@/lib/basePath";
import type { SportId } from "./config";

export function sportPath(sport: SportId): string {
  return `${basePath}/${sport}`;
}

export function competitionPath(sport: SportId, competition: string): string {
  return `${basePath}/${sport}/${competition}`;
}

export function hubPath(
  sport: SportId,
  competition: string,
  section = ""
): string {
  const base = competitionPath(sport, competition);
  if (!section) return `${base}/`;
  const seg = section.startsWith("/") ? section : `/${section}`;
  return `${base}${seg}/`;
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
