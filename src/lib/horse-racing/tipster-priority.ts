import type { TipsterPick } from "./types";
import { lookupRegisteredTipster } from "./tipster-registry";

/** National press / corporate tip lines — priced in, low edge. */
export const MAINSTREAM_OUTLETS = [
  "daily mail",
  "the guardian",
  "guardian",
  "telegraph",
  "the times",
  "daily mirror",
  "daily record",
  "the sun",
  "irish sun",
  "racing post",
  "sporting life",
  "attheraces",
  "oddschecker",
  "itv",
  "bbc",
  "sky sports",
  "postdata",
  "newsboy",
  "spotlight",
  "topspeed",
  "rp ratings",
  "racing uk",
  "express",
  "mirror",
  "independent",
  "marlborough",
  "sunday mail",
  "rockavon",
  "newmarket",
  "david milnes",
];

export function isMainstreamTipster(name: string): boolean {
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
  return MAINSTREAM_OUTLETS.some((o) => n.includes(o));
}

export function nonMainstreamTips(names: string[]): string[] {
  return names.filter((n) => !isMainstreamTipster(n));
}

/** Relative weight for stacking tipster signals into the model. */
export function tipsterSignalWeight(pick: TipsterPick): number {
  const reg = lookupRegisteredTipster(pick.tipster);
  if (reg) {
    if (reg.tier === "elite") return 1.45;
    if (reg.tier === "strong") return 1.25;
    return 1.1;
  }
  if (pick.platform === "tipster-league") return 1.35;
  if (pick.platform === "olbg") return 1.3;
  if (pick.platform === "bethq") return 1.2;
  if (pick.platform === "bettinggods") return 1.25;
  if (pick.platform === "leak") return 1.35;
  if (pick.platform === "reddit") return 1.25;
  if (pick.platform === "twitter") return 1.15;
  if (/insider|whisper|stable|gallop|gamble|steamer|well backed/i.test(pick.trackRecord)) {
    return 1.2;
  }
  if (/elite|%\s*strike|proven record/i.test(pick.trackRecord)) return 1.15;
  if (pick.platform === "press" && isMainstreamTipster(pick.tipster)) return 0.3;
  if (isMainstreamTipster(pick.tipster)) return 0.4;
  return 1;
}

/** Skip low-edge mainstream-only press churn. */
export function isInsiderGradePick(pick: TipsterPick): boolean {
  if (
    pick.platform === "tipster-league" ||
    pick.platform === "olbg" ||
    pick.platform === "bethq" ||
    pick.platform === "bettinggods"
  ) {
    return true;
  }
  if (pick.platform === "leak" || pick.platform === "reddit") return true;
  if (pick.hot) return true;
  if (/insider|whisper|stable|elite|%\s*strike|proven record|gamble|steamer/i.test(pick.trackRecord)) {
    return true;
  }
  if (pick.platform === "press" && isMainstreamTipster(pick.tipster)) return false;
  return pick.confidence >= 0.62;
}
