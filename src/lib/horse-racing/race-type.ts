import type { HorseRace, RacingFactorKey } from "./types";

export type RaceSegment =
  | "flat_sprint"
  | "flat_mile"
  | "flat_staying"
  | "nh"
  | "aw";

export function segmentRace(race: HorseRace): RaceSegment {
  const name = `${race.name} ${race.raceClass} ${race.pattern ?? ""}`.toLowerCase();
  if (/standard|slow|fast/i.test(race.going)) return "aw";
  if (/hurdle|chase|bumper|nh flat|national hunt/i.test(name)) return "nh";

  const y = race.distanceYards;
  if (!y || y <= 1320) return "flat_sprint";
  if (y <= 1760) return "flat_mile";
  return "flat_staying";
}

/** Segment-specific weight multipliers (renormalised by caller). */
const SEGMENT_MULTIPLIERS: Record<
  RaceSegment,
  Partial<Record<RacingFactorKey, number>>
> = {
  flat_sprint: { draw: 1.8, market: 1.1, form: 1.05, freshness: 1.1, distance: 0.7 },
  flat_mile: { draw: 1.3, topspeed: 1.15, rating: 1.1, class: 1.05 },
  flat_staying: {
    distance: 1.35,
    form: 1.15,
    freshness: 1.2,
    draw: 0.6,
    topspeed: 1.1,
  },
  nh: {
    course: 1.25,
    going: 1.2,
    trainer: 1.15,
    form: 1.1,
    draw: 0.2,
    market: 0.95,
  },
  aw: {
    draw: 0.5,
    going: 0.4,
    form: 1.1,
    topspeed: 1.2,
    freshness: 1.1,
  },
};

export function weightsForSegment(
  base: Record<RacingFactorKey, number>,
  segment: RaceSegment
): Record<RacingFactorKey, number> {
  const mult = SEGMENT_MULTIPLIERS[segment];
  const out = { ...base };
  let sum = 0;
  for (const key of Object.keys(out) as RacingFactorKey[]) {
    out[key] = out[key] * (mult[key] ?? 1);
    sum += out[key];
  }
  if (sum > 0) {
    for (const key of Object.keys(out) as RacingFactorKey[]) {
      out[key] = out[key] / sum;
    }
  }
  return out;
}
