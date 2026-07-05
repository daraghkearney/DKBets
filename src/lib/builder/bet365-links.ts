import type { BuilderLeg, BuilderSlip } from "./types";

const BET365_REDIRECT =
  "https://www.bet365.com/dl/sportsbookredirect?bet=1&bs=";

export type Bet365SlipLinkMode = "betslip" | "event";

export interface Bet365SlipLink {
  href: string;
  mode: Bet365SlipLinkMode;
  /** Legs covered by a one-click pre-loaded betslip (0 for event-only links). */
  coveredLegs: number;
  totalLegs: number;
}

/** Build bet365.com sportsbookredirect URL from internal selection IDs. */
export function buildBet365RedirectUrl(legs: BuilderLeg[]): string | null {
  if (!legs.length) return null;
  if (!legs.every((leg) => leg.bet365SelectionId)) return null;

  const bs = legs
    .map((leg) => `|${leg.bet365SelectionId}~${leg.fractionalOdds}~0`)
    .join("");

  return `${BET365_REDIRECT}${encodeURIComponent(bs)}`;
}

/** Prefer a pre-loaded acca link, then single-leg deep link, then match page. */
export function buildBet365SlipLink(slip: BuilderSlip): Bet365SlipLink | null {
  const legs = slip.legs;
  if (!legs.length) return null;

  const redirect = buildBet365RedirectUrl(legs);
  if (redirect) {
    return {
      href: redirect,
      mode: "betslip",
      coveredLegs: legs.length,
      totalLegs: legs.length,
    };
  }

  if (legs.length === 1) {
    const leg = legs[0]!;
    if (leg.bet365Link) {
      return {
        href: leg.bet365Link,
        mode: "betslip",
        coveredLegs: 1,
        totalLegs: 1,
      };
    }
    if (leg.bet365EventUrl) {
      return {
        href: leg.bet365EventUrl,
        mode: "event",
        coveredLegs: 0,
        totalLegs: 1,
      };
    }
  }

  const matchIds = new Set(legs.map((l) => l.matchId));
  if (matchIds.size === 1) {
    const eventUrl = legs.find((l) => l.bet365EventUrl)?.bet365EventUrl;
    if (eventUrl) {
      return {
        href: eventUrl,
        mode: "event",
        coveredLegs: 0,
        totalLegs: legs.length,
      };
    }
  }

  const linked = legs.filter((l) => l.bet365Link);
  if (linked.length === 1) {
    return {
      href: linked[0]!.bet365Link!,
      mode: "betslip",
      coveredLegs: 1,
      totalLegs: legs.length,
    };
  }

  const eventUrl = legs.find((l) => l.bet365EventUrl)?.bet365EventUrl;
  if (eventUrl) {
    return {
      href: eventUrl,
      mode: "event",
      coveredLegs: 0,
      totalLegs: legs.length,
    };
  }

  return null;
}

export function bet365LinkLabel(link: Bet365SlipLink): string {
  if (link.mode === "betslip" && link.coveredLegs === link.totalLegs) {
    return link.totalLegs === 1
      ? "Open on Bet365"
      : `Open ${link.totalLegs}-fold on Bet365`;
  }
  if (link.mode === "betslip" && link.coveredLegs === 1) {
    return "Open first leg on Bet365";
  }
  return "Open match on Bet365";
}

export function bet365LinkHint(link: Bet365SlipLink): string {
  if (link.mode === "betslip" && link.coveredLegs === link.totalLegs) {
    return "Pre-loaded Bet365 betslip — review and place your bet there.";
  }
  if (link.mode === "event") {
    return "Same-game Bet Builder slips must be built on Bet365 — use the legs listed above.";
  }
  return "Only part of this slip could be deep-linked; add remaining legs manually on Bet365.";
}
