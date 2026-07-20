import type { FixtureSummary } from "@/lib/stats/types";
import { startOfLocalDay } from "@/lib/format";

export interface FixtureDateBucket<T extends FixtureSummary> {
  key: string;
  label: string;
  fixtures: T[];
}

/** Group fixtures by local calendar day, sorted ascending by kickoff. */
export function groupFixturesByDate<T extends FixtureSummary>(
  fixtures: T[]
): FixtureDateBucket<T>[] {
  const sorted = [...fixtures].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );
  const map = new Map<string, FixtureDateBucket<T>>();

  for (const fx of sorted) {
    const day = startOfLocalDay(new Date(fx.kickoff));
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        key,
        label: day.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        fixtures: [],
      };
      map.set(key, bucket);
    }
    bucket.fixtures.push(fx);
  }

  return [...map.values()];
}

export function formatDayRangeLabel(buckets: FixtureDateBucket<FixtureSummary>[]): string {
  if (buckets.length === 0) return "";
  if (buckets.length === 1) return buckets[0]!.label;
  const first = buckets[0]!;
  const last = buckets[buckets.length - 1]!;
  const short = (isoKey: string, label: string) => {
    const parts = label.split(" ");
    // Prefer "21 Aug" style from the long label when possible
    if (parts.length >= 3) {
      const day = parts[parts.length - 2];
      const month = parts[parts.length - 1]?.slice(0, 3);
      return `${day} ${month}`;
    }
    return isoKey;
  };
  return `${short(first.key, first.label)} – ${short(last.key, last.label)}`;
}
