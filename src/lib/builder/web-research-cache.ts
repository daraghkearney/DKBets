import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { ContextInsight } from "./context-types";

const CACHE_DIR = path.join(process.cwd(), ".cache", "web-research");
export const WEB_RESEARCH_CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface WebResearchCacheEntry {
  version: number;
  savedAt: string;
  matchId: number;
  insights: ContextInsight[];
}

function cachePath(matchId: number): string {
  return path.join(CACHE_DIR, `${matchId}.json`);
}

export async function loadCachedWebResearch(
  matchId: number,
  options: { ignoreAge?: boolean } = {}
): Promise<ContextInsight[] | null> {
  try {
    const raw = await readFile(cachePath(matchId), "utf8");
    const data = JSON.parse(raw) as WebResearchCacheEntry;
    if (data.version !== WEB_RESEARCH_CACHE_VERSION) return null;
    if (
      !options.ignoreAge &&
      Date.now() - new Date(data.savedAt).getTime() > CACHE_MAX_AGE_MS
    ) {
      return null;
    }
    return data.insights ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedWebResearch(
  matchId: number,
  insights: ContextInsight[]
): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const payload: WebResearchCacheEntry = {
    version: WEB_RESEARCH_CACHE_VERSION,
    savedAt: new Date().toISOString(),
    matchId,
    insights,
  };
  await writeFile(cachePath(matchId), JSON.stringify(payload), "utf8");
}
