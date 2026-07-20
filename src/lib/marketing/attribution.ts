import { basePath } from "@/lib/basePath";

const STORAGE_KEY = "statmanac_attribution";

const TRACKED_PARAMS = [
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type TrackedParam = (typeof TRACKED_PARAMS)[number];

export interface Attribution {
  ref?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  captured_at: string;
  landing_path: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function parseAttributionFromSearch(
  search: string,
  pathname: string
): Attribution | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const data: Partial<Attribution> = {};
  let found = false;

  for (const key of TRACKED_PARAMS) {
    const value = params.get(key)?.trim();
    if (value) {
      data[key] = value;
      found = true;
    }
  }

  if (!found) return null;

  return {
    ...data,
    captured_at: new Date().toISOString(),
    landing_path: pathname,
  };
}

export function getStoredAttribution(): Attribution | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Attribution;
  } catch {
    return null;
  }
}

/** First-touch only — keeps the original campaign source. */
export function storeAttribution(attribution: Attribution): void {
  if (!isBrowser()) return;
  if (getStoredAttribution()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    /* quota / private mode */
  }
}

export function captureAttributionFromLocation(
  search: string,
  pathname: string
): Attribution | null {
  const parsed = parseAttributionFromSearch(search, pathname);
  if (!parsed) return getStoredAttribution();
  storeAttribution(parsed);
  return parsed;
}

export function attributionToSearchParams(
  attribution?: Attribution | null
): URLSearchParams {
  const params = new URLSearchParams();
  const data = attribution ?? (isBrowser() ? getStoredAttribution() : null);
  if (!data) return params;

  for (const key of TRACKED_PARAMS) {
    const value = data[key];
    if (value) params.set(key, value);
  }
  return params;
}

/** Append stored UTM/ref params to an internal app path. */
export function withAttribution(path: string, extra?: Partial<Attribution>): string {
  const [base, hash = ""] = path.split("#");
  const [pathname, existingQuery = ""] = base.split("?");
  const params = new URLSearchParams(existingQuery);

  const stored = isBrowser() ? getStoredAttribution() : null;
  const merged: Partial<Attribution> = { ...stored, ...extra };

  for (const key of TRACKED_PARAMS) {
    const value = merged[key];
    if (value && !params.has(key)) params.set(key, value);
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  return `${pathname}${suffix}${hash ? `#${hash}` : ""}`;
}

/**
 * Build a shareable outreach link for tipsters.
 * Example: buildCampaignLink("/football/premier-league/builder/", { ref: "andyrobson" })
 */
export function buildCampaignLink(
  path: string,
  campaign: Partial<Attribution> & { ref: string }
): string {
  const [pathname, existingQuery = ""] = path.split("?");
  const params = new URLSearchParams(existingQuery);

  for (const key of TRACKED_PARAMS) {
    const value = campaign[key];
    if (value) params.set(key, value);
  }

  if (!params.has("utm_source") && campaign.ref) {
    params.set("utm_source", campaign.ref);
  }
  if (!params.has("utm_medium")) {
    params.set("utm_medium", "tipster");
  }
  if (!params.has("utm_campaign")) {
    params.set("utm_campaign", "world_cup_free");
  }

  const query = params.toString();
  const fullPath = query ? `${pathname}?${query}` : pathname;
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://statmanac.com";
  return `${origin}${basePath}${fullPath}`;
}
