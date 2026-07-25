/**
 * Discover upcoming fixtures from FotMob's date feed.
 * Needed for competitions (e.g. CL qualification) that aren't listed under
 * the main league page (`/api/data/leagues?id=42`).
 */

import { getMatchesByDate, pool } from "./fotmob";
import { parseDateFeedFixtures, type RawFixture } from "./parse";

function yyyymmddUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addUtcDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Scan today..+lookAheadDays (UTC) for leagues whose name matches `pattern`. */
export async function discoverFixturesByDate(
  pattern: RegExp,
  lookAheadDays = 21
): Promise<RawFixture[]> {
  const start = new Date();
  const dates: string[] = [];
  for (let i = 0; i <= lookAheadDays; i++) {
    dates.push(yyyymmddUTC(addUtcDays(start, i)));
  }

  const days = await pool(dates, 4, async (date) => {
    try {
      return await getMatchesByDate(date);
    } catch {
      return null;
    }
  });

  const byId = new Map<number, RawFixture>();
  for (const day of days) {
    if (!day) continue;
    for (const fx of parseDateFeedFixtures(day, pattern)) {
      byId.set(fx.id, fx);
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.kickoff.localeCompare(b.kickoff)
  );
}
