import { readFile } from "fs/promises";
import path from "path";
import MatchDetailClient from "./MatchDetailClient";

export async function generateStaticParams() {
  return readFixtureIds().catch(() => [{ id: "0" }]);
}

async function readFixtureIds(): Promise<Array<{ id: string }>> {
  const file = path.join(
    process.cwd(),
    "public/data/stats/fixture-ids.json"
  );
  const raw = await readFile(file, "utf8");
  const { ids } = JSON.parse(raw) as { ids: number[] };
  return ids.map((id) => ({ id: String(id) }));
}

export default function MatchDetailPage() {
  return <MatchDetailClient />;
}
