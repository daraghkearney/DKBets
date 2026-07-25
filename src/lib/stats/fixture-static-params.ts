import { readFile } from "fs/promises";
import path from "path";
import {
  PRIMARY_FOOTBALL_COMPETITION_ID,
  footballCompetition,
} from "@/lib/sports/football";

/**
 * Static export requires at least one param. Empty upcoming fixtures
 * (tournament over / preseason) must not return [].
 */
export async function footballFixtureStaticParams(
  competitionId: string = PRIMARY_FOOTBALL_COMPETITION_ID
): Promise<Array<{ id: string }>> {
  const meta = footballCompetition(competitionId);
  const file =
    !meta || meta.dataRoot === "legacy"
      ? path.join(process.cwd(), "public/data/stats/fixture-ids.json")
      : path.join(
          process.cwd(),
          `public/data/football/${competitionId}/stats/fixture-ids.json`
        );

  try {
    const raw = await readFile(file, "utf8");
    const { ids } = JSON.parse(raw) as { ids?: Array<number | string> };
    const params = (ids ?? []).map((id) => ({ id: String(id) }));
    return params.length > 0 ? params : [{ id: "0" }];
  } catch {
    return [{ id: "0" }];
  }
}
