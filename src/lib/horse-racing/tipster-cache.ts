import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { TipsterPick } from "./types";

const CACHE_DIR = path.join(process.cwd(), ".cache", "racing-tipsters");
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface TipsterCacheEntry {
  savedAt: string;
  meeting: string;
  picks: TipsterPick[];
}

function cachePath(meeting: string): string {
  return path.join(CACHE_DIR, `${meeting}.json`);
}

export async function loadCachedTipsters(
  meeting: string
): Promise<TipsterPick[] | null> {
  try {
    const raw = await readFile(cachePath(meeting), "utf8");
    const data = JSON.parse(raw) as TipsterCacheEntry;
    if (Date.now() - new Date(data.savedAt).getTime() > CACHE_MAX_AGE_MS) {
      return null;
    }
    return data.picks ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedTipsters(
  meeting: string,
  picks: TipsterPick[]
): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const payload: TipsterCacheEntry = {
    savedAt: new Date().toISOString(),
    meeting,
    picks,
  };
  await writeFile(cachePath(meeting), JSON.stringify(payload), "utf8");
}
