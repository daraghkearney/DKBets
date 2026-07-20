import { readFile } from "fs/promises";
import path from "path";

/**
 * Static export requires at least one param. Empty upcoming fixtures
 * (tournament over / preseason) must not return [].
 */
export async function footballFixtureStaticParams(): Promise<
  Array<{ id: string }>
> {
  try {
    const file = path.join(
      process.cwd(),
      "public/data/stats/fixture-ids.json"
    );
    const raw = await readFile(file, "utf8");
    const { ids } = JSON.parse(raw) as { ids?: Array<number | string> };
    const params = (ids ?? []).map((id) => ({ id: String(id) }));
    return params.length > 0 ? params : [{ id: "0" }];
  } catch {
    return [{ id: "0" }];
  }
}
