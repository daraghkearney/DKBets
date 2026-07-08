import type { HorseFormRun, HorseRunner } from "./types";

/** Parse UK form string positions (1-9, 0=out, -/=sep, P=pulled up, etc.) */
export function parseFormPositions(form: string): number[] {
  const out: number[] = [];
  for (const ch of form.replace(/[-/]/g, "")) {
    if (ch >= "1" && ch <= "9") out.push(Number(ch));
    else if (ch === "0" || ch === "F" || ch === "P" || ch === "U") out.push(99);
  }
  return out;
}

export function distanceYards(dist: string): number {
  const m = dist.match(/(\d+)m\s*(\d+)?(?:y|f)?/i);
  if (m) return Number(m[1]) * 1760 + Number(m[2] ?? 0);
  const f = dist.match(/(\d+)f(?:\s*(\d+)y)?/i);
  if (f) return Number(f[1]) * 220 + Number(f[2] ?? 0);
  const y = dist.match(/(\d+)y/i);
  if (y) return Number(y[1]);
  return 0;
}

/** Does historical form suggest this trip suits the horse? */
export function scoreDistanceFit(
  runs: HorseFormRun[],
  targetYards: number
): { score: number; notes: string[] } {
  const notes: string[] = [];
  if (!runs.length || !targetYards) return { score: 0.5, notes: ["No form for distance analysis"] };

  const tolerance = targetYards * 0.12;
  const similar = runs.filter(
    (r) => Math.abs(r.distanceYards - targetYards) <= tolerance
  );
  if (!similar.length) {
    notes.push(`No runs within ${Math.round(tolerance)}y of today's trip`);
    return { score: 0.45, notes };
  }

  const good = similar.filter((r) => r.position <= 3).length;
  const rate = good / similar.length;
  notes.push(
    `${good}/${similar.length} top-3 finishes at similar distances (${Math.round(rate * 100)}%)`
  );
  return { score: Math.min(0.95, 0.35 + rate * 0.6), notes };
}

/** Course-specific form at today's venue */
export function scoreCourseFit(
  runs: HorseFormRun[],
  course: string
): { score: number; notes: string[] } {
  const notes: string[] = [];
  const atCourse = runs.filter(
    (r) => r.course.toLowerCase() === course.toLowerCase()
  );
  if (!atCourse.length) {
    notes.push(`No previous runs at ${course}`);
    return { score: 0.5, notes };
  }
  const wins = atCourse.filter((r) => r.position === 1).length;
  const places = atCourse.filter((r) => r.position <= 3).length;
  notes.push(
    `${wins} win${wins === 1 ? "" : "s"}, ${places} place${places === 1 ? "" : "s"} at ${course}`
  );
  const rate = places / atCourse.length;
  return { score: Math.min(0.95, 0.3 + rate * 0.65), notes };
}

/** Recent form trend from last 5 runs */
export function scoreRecentForm(runs: HorseFormRun[]): {
  score: number;
  notes: string[];
} {
  const notes: string[] = [];
  const recent = runs.slice(0, 5);
  if (!recent.length) return { score: 0.5, notes: ["No recent form"] };

  const positions = recent.map((r) => r.position);
  const avg =
    positions.reduce((a, b) => a + Math.min(b, 10), 0) / positions.length;
  const top3 = positions.filter((p) => p <= 3).length;
  notes.push(
    `Last ${recent.length}: avg finish ${avg.toFixed(1)}, ${top3} top-3`
  );
  const score = Math.max(0.2, Math.min(0.95, 1 - (avg - 1) / 9));
  return { score, notes };
}

export function enrichRunner(
  runner: Omit<
    HorseRunner,
    "distanceFitScore" | "courseFitScore" | "recentFormScore" | "overallScore" | "notes"
  >,
  raceCourse: string,
  raceYards: number
): HorseRunner {
  const dist = scoreDistanceFit(runner.formRuns, raceYards);
  const course = scoreCourseFit(runner.formRuns, raceCourse);
  const recent = scoreRecentForm(runner.formRuns);

  const overallScore =
    dist.score * 0.35 + course.score * 0.3 + recent.score * 0.35;
  const notes = [...dist.notes, ...course.notes, ...recent.notes];

  return {
    ...runner,
    distanceFitScore: dist.score,
    courseFitScore: course.score,
    recentFormScore: recent.score,
    overallScore,
    notes,
  };
}
