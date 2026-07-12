import { courseSlug } from "./dates";

export type DistanceBand = "sprint" | "mile" | "middle" | "staying";

/** Classify trip length for draw-bias lookup. */
export function distanceBand(yards: number): DistanceBand {
  if (!yards || yards <= 1320) return "sprint"; // ≤6f
  if (yards <= 1760) return "mile"; // ≤8f
  if (yards <= 2640) return "middle"; // ≤12f
  return "staying";
}

/**
 * Draw bias profiles for UK/IRE courses where stall position matters.
 * `low` / `high` = relative advantage; `neutral` = minimal bias.
 */
const DRAW_PROFILES: Record<
  string,
  Partial<Record<DistanceBand, "low" | "mid" | "high" | "neutral">>
> = {
  chester: { sprint: "low", mile: "low", middle: "low" },
  brighton: { sprint: "low", mile: "low" },
  epsom: { sprint: "low", mile: "mid" },
  "newmarket-july": { sprint: "high", mile: "mid" },
  newmarket: { sprint: "high", mile: "mid", middle: "mid" },
  ascot: { sprint: "mid", mile: "mid" },
  york: { sprint: "mid", mile: "mid" },
  doncaster: { sprint: "mid", mile: "mid" },
  goodwood: { sprint: "high", mile: "mid" },
  haydock: { sprint: "low", mile: "mid" },
  lingfield: { sprint: "low", mile: "neutral" },
  kempton: { sprint: "neutral", mile: "neutral", middle: "neutral" },
  wolverhampton: { sprint: "neutral", mile: "neutral", middle: "neutral" },
  southwell: { sprint: "neutral", mile: "neutral" },
  chelmsford: { sprint: "neutral", mile: "neutral" },
};

function profileKey(course: string): string {
  const slug = courseSlug(course);
  if (slug.includes("newmarket") && slug.includes("july")) return "newmarket-july";
  if (slug.includes("newmarket")) return "newmarket";
  return slug;
}

function drawPositionScore(
  draw: number,
  fieldSize: number,
  bias: "low" | "mid" | "high" | "neutral"
): number {
  if (fieldSize < 6 || draw < 1) return 0.5;
  const rel = (draw - 1) / Math.max(1, fieldSize - 1); // 0 = inside … 1 = outside

  if (bias === "neutral") return 0.5;

  if (bias === "low") {
    if (rel <= 0.2) return 0.88;
    if (rel <= 0.35) return 0.72;
    if (rel >= 0.75) return 0.32;
    return 0.5;
  }
  if (bias === "high") {
    if (rel >= 0.8) return 0.86;
    if (rel >= 0.65) return 0.72;
    if (rel <= 0.15) return 0.35;
    return 0.5;
  }
  // mid — centre stalls often favoured on turning tracks
  if (rel >= 0.35 && rel <= 0.65) return 0.78;
  if (rel <= 0.15 || rel >= 0.85) return 0.4;
  return 0.55;
}

export function scoreDraw(
  course: string,
  distanceYards: number,
  draw: string | number | undefined,
  fieldSize: number,
  going = ""
): { score: number; notes: string[] } {
  const drawNum = typeof draw === "number" ? draw : Number(String(draw ?? "").trim());
  if (!drawNum || drawNum < 1 || fieldSize < 6) {
    return { score: 0.5, notes: [] };
  }

  if (/standard|slow|fast/i.test(going)) {
    return { score: 0.5, notes: ["Draw less relevant on AW"] };
  }

  const band = distanceBand(distanceYards);
  const key = profileKey(course);
  const bias = DRAW_PROFILES[key]?.[band] ?? "neutral";
  const score = drawPositionScore(drawNum, fieldSize, bias);

  if (bias === "neutral" || score === 0.5) {
    return { score: 0.5, notes: [] };
  }

  const label =
    bias === "low"
      ? "low draws favoured"
      : bias === "high"
        ? "high draws favoured"
        : "centre stalls favoured";

  return {
    score,
    notes: [`Draw ${drawNum} — ${label} at ${course} (${band})`],
  };
}
