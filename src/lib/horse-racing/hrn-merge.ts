/**
 * Merge scraped HorseRacing.net data into Racing API racecards, filling
 * the gaps the free API tier leaves: odds, ratings, strike rates, tips,
 * spotlight comments and verdicts. Also turns per-runner tipster picks
 * into TipsterPick entries so every meeting has real, named tips.
 */
import { courseSlug, to24hTime } from "./dates";
import {
  distanceYards,
  enrichRunner,
  parseFormPositions,
  scoreFreshness,
  scoreMarket,
} from "./form-analysis";
import { normalizeHorseName } from "./model";
import type { HrnRace, HrnRunner } from "./hrnet";
import type { HorseFormRun, HorseRace, HorseRunner, TipsterPick } from "./types";

function sameCourse(apiCourse: string, hrnSlug: string): boolean {
  const a = courseSlug(apiCourse);
  return a === hrnSlug || a.startsWith(hrnSlug) || hrnSlug.startsWith(a);
}

function nameOverlap(race: HorseRace, hrn: HrnRace): number {
  const ours = new Set(race.runners.map((r) => normalizeHorseName(r.name)));
  let hits = 0;
  for (const hr of hrn.runners) {
    if (ours.has(normalizeHorseName(hr.name))) hits++;
  }
  return hits / Math.max(1, race.runners.length);
}

function findHrnRace(race: HorseRace, hrnRaces: HrnRace[]): HrnRace | null {
  const atCourse = hrnRaces.filter((h) => sameCourse(race.course, h.courseSlug));
  if (!atCourse.length) return null;

  const time = to24hTime(race.time);
  const byTime = atCourse.find((h) => to24hTime(h.time) === time);
  if (byTime && nameOverlap(race, byTime) >= 0.3) return byTime;

  // Time mismatch (off-time changed) — fall back to best runner overlap
  let best: HrnRace | null = null;
  let bestScore = 0.5;
  for (const h of atCourse) {
    const score = nameOverlap(race, h);
    if (score > bestScore) {
      best = h;
      bestScore = score;
    }
  }
  return best;
}

function pushNote(runner: HorseRunner, note: string): void {
  if (!runner.notes.includes(note)) runner.notes.push(note);
}

function mergeRunner(runner: HorseRunner, hr: HrnRunner): void {
  if (hr.nonRunner) return;

  if (runner.odds == null && hr.odds != null && hr.odds > 1) {
    runner.odds = hr.odds;
    const mk = scoreMarket(hr.odds);
    runner.marketScore = mk.score;
    for (const n of mk.notes) pushNote(runner, n);
  }

  if (runner.officialRating == null && hr.officialRating != null) {
    runner.officialRating = hr.officialRating;
  }
  runner.rpr = hr.rpr;
  runner.topspeed = hr.topspeed;

  if (runner.lastRunDays == null && hr.lastRanDays != null) {
    runner.lastRunDays = hr.lastRanDays;
    runner.freshnessScore = scoreFreshness(
      runner.formRuns,
      hr.lastRanDays
    ).score;
  }

  runner.tipCount = hr.tipCount;
  runner.tippedBy = hr.tippedBy;
  if (hr.spotlight) runner.spotlight = hr.spotlight;
  runner.trainerStrikePct = hr.trainerPct;
  runner.jockeyStrikePct = hr.jockeyPct;

  if (hr.courseWinner) {
    runner.courseWinner = true;
    runner.courseFitScore = Math.max(runner.courseFitScore, 0.72);
    pushNote(runner, "Previous course winner");
  }
  if (hr.distanceWinner) {
    runner.distanceWinner = true;
    runner.distanceFitScore = Math.max(runner.distanceFitScore, 0.72);
    pushNote(runner, "Previous distance winner");
  }
  if (hr.wonLastTimeOut) {
    runner.wonLastTimeOut = true;
    runner.recentFormScore = Math.max(runner.recentFormScore, 0.78);
    pushNote(runner, "Won last time out");
  }
}

/** Enrich a day's races in place. Returns how many races were matched. */
export function mergeHrnIntoRaces(
  races: HorseRace[],
  hrnRaces: HrnRace[]
): number {
  let matched = 0;
  for (const race of races) {
    const hrn = findHrnRace(race, hrnRaces);
    if (!hrn) continue;
    matched++;

    if (hrn.verdict) race.verdict = hrn.verdict;
    if (!race.going && hrn.going) race.going = hrn.going;

    const byName = new Map(
      hrn.runners.map((r) => [normalizeHorseName(r.name), r])
    );
    for (const runner of race.runners) {
      const hr = byName.get(normalizeHorseName(runner.name));
      if (hr) mergeRunner(runner, hr);
    }
  }
  return matched;
}

function formRunsFromHrn(
  hr: HrnRunner,
  race: HrnRace
): HorseFormRun[] {
  const positions = parseFormPositions(hr.form);
  if (!positions.length) return [];
  return positions.slice(0, 6).map((pos, i) => ({
    date: `recent-${i}`,
    course: hr.courseWinner ? race.course : "",
    distance: race.distance,
    distanceYards: race.distanceYards,
    going: race.going,
    position: pos,
    runners: 12,
    jockey: hr.jockey,
    trainer: hr.trainer,
    weight: hr.weight,
    odds: "",
    comment: `Form ${hr.form[i] ?? ""}`,
  }));
}

/** Build full racecards from scraped HRN data (API fallback). */
export function racesFromHrn(hrnRaces: HrnRace[], isoDate: string): HorseRace[] {
  const races: HorseRace[] = [];
  for (const hrn of hrnRaces) {
    const runners: HorseRunner[] = [];
    for (const hr of hrn.runners) {
      if (hr.nonRunner) continue;
      const formRuns = formRunsFromHrn(hr, hrn);
      const base = enrichRunner(
        {
          id: `hrn-${hrn.courseSlug}-${isoDate}-${hrn.time}-${hr.number ?? hr.name}`,
          name: hr.name,
          age: hr.age ?? 5,
          weight: hr.weight,
          jockey: hr.jockey,
          trainer: hr.trainer,
          form: hr.form,
          odds: hr.odds,
          officialRating: hr.officialRating,
          lastRunDays: hr.lastRanDays,
          headgear: "",
          draw: hr.draw != null ? String(hr.draw) : "",
          formRuns,
          rpr: hr.rpr,
          topspeed: hr.topspeed,
          tipCount: hr.tipCount,
          tippedBy: hr.tippedBy,
          spotlight: hr.spotlight,
          trainerStrikePct: hr.trainerPct,
          jockeyStrikePct: hr.jockeyPct,
          courseWinner: hr.courseWinner,
          distanceWinner: hr.distanceWinner,
          wonLastTimeOut: hr.wonLastTimeOut,
        },
        {
          course: hrn.course,
          distanceYards:
            hrn.distanceYards || distanceYards(hrn.distance) || 1760,
          going: hrn.going,
          raceClass: hrn.raceClass,
        }
      );
      mergeRunner(base, hr);
      runners.push(base);
    }
    if (!runners.length) continue;
    races.push({
      id: `hrn-${hrn.courseSlug}-${isoDate}-${to24hTime(hrn.time)}`,
      date: isoDate,
      time: hrn.time,
      name: hrn.title || "Race",
      course: hrn.course,
      distance: hrn.distance || (hrn.distanceYards ? `${hrn.distanceYards}y` : "1m"),
      distanceYards: hrn.distanceYards || distanceYards(hrn.distance) || 1760,
      going: hrn.going,
      raceClass: hrn.raceClass,
      verdict: hrn.verdict,
      runners,
    });
  }
  return races;
}

/**
 * Build tipster picks from merged racecard data: newspaper/expert tips
 * per runner plus the site verdict selection. Red-hot = the verdict pick
 * that also has strong independent tipster consensus.
 */
export function buildHrnTipsterPicks(races: HorseRace[]): TipsterPick[] {
  const picks: TipsterPick[] = [];

  for (const race of races) {
    const verdictNames = (race.verdict ? verdictCaps(race.verdict) : []).map(
      (n) => normalizeHorseName(n)
    );

    const tipped = race.runners
      .filter((r) => (r.tipCount ?? 0) > 0)
      .sort((a, b) => (b.tipCount ?? 0) - (a.tipCount ?? 0));
    if (!tipped.length && !verdictNames.length) continue;

    const maxTips = tipped[0]?.tipCount ?? 0;

    for (const runner of race.runners) {
      const tips = runner.tipCount ?? 0;
      const isVerdictPick = verdictNames.includes(
        normalizeHorseName(runner.name)
      );
      const isTopTipped = tips > 0 && tips === maxTips;

      // Surface verdict picks, the race leader on tips, or any named tip.
      if (!isVerdictPick && !isTopTipped && tips < 1) continue;

      const names = (runner.tippedBy ?? []).slice(0, 4);
      const tipsterLabel = isVerdictPick
        ? names.length
          ? `Expert verdict + ${names.join(", ")}`
          : "Expert verdict"
        : names.join(", ") || "Press tipsters";

      const confidence = Math.min(
        0.95,
        0.5 + Math.min(0.3, tips * 0.06) + (isVerdictPick ? 0.12 : 0)
      );
      const hot = (isVerdictPick && tips >= 3) || tips >= 5;

      picks.push({
        id: `hrn-${race.id}-${runner.id}`,
        tipster: tipsterLabel,
        horse: runner.name,
        raceId: race.id,
        confidence,
        trackRecord:
          tips > 0
            ? `${tips} independent tipster${tips === 1 ? "" : "s"} today${isVerdictPick ? " · site verdict" : ""}`
            : "HorseRacing.net expert verdict",
        rationale:
          runner.spotlight ||
          race.verdict ||
          `Backed for the ${race.time} at ${race.course}`,
        hot,
        platform: "press",
        matchedRunner: runner.name,
      });
    }
  }

  return picks.sort(
    (a, b) =>
      Number(b.hot ?? false) - Number(a.hot ?? false) ||
      b.confidence - a.confidence
  );
}

function verdictCaps(verdict: string): string[] {
  const out: string[] = [];
  for (const m of verdict.matchAll(
    /\b([A-Z][A-Z']{2,}(?:\s+[A-Z][A-Z']{2,}){0,3})\b/g
  )) {
    if (m[1].length >= 4) out.push(m[1]);
  }
  return out;
}
