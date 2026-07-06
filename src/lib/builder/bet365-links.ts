import {
  buildBet365RedirectUrl,
  resolveBet365LegLink,
} from "./bet365-deeplink";
import type { BuilderLeg, BuilderSlip } from "./types";

export type Bet365SlipLinkMode = "betslip" | "event";

export interface Bet365SlipLink {
  href: string;
  mode: Bet365SlipLinkMode;
  /** Legs covered by a one-click pre-loaded betslip (0 for event-only links). */
  coveredLegs: number;
  totalLegs: number;
}

export { buildBet365RedirectUrl, resolveBet365LegLink };

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
    const legLink = resolveBet365LegLink(legs[0]!);
    if (legLink) {
      return {
        href: legLink.href,
        mode: legLink.mode,
        coveredLegs: legLink.mode === "betslip" ? 1 : 0,
        totalLegs: 1,
      };
    }
  }

  const matchIds = new Set(legs.map((l) => l.matchId));
  const isSameGame = matchIds.size === 1;

  // Same-game slips: prefer per-leg deeplinks in the UI; slip button opens the match.
  if (isSameGame) {
    const eventUrl = legs.find((l) => l.bet365EventUrl)?.bet365EventUrl;
    const deeplinkLegs = legs.filter(
      (l) => resolveBet365LegLink(l)?.mode === "betslip"
    );
    if (deeplinkLegs.length === 1) {
      const one = resolveBet365LegLink(deeplinkLegs[0]!)!;
      return {
        href: one.href,
        mode: "betslip",
        coveredLegs: 1,
        totalLegs: legs.length,
      };
    }
    if (eventUrl) {
      return {
        href: eventUrl,
        mode: "event",
        coveredLegs: 0,
        totalLegs: legs.length,
      };
    }
  }

  const linked = legs.filter((l) => l.bet365Link || l.bet365SelectionId);
  if (linked.length === 1) {
    const one = resolveBet365LegLink(linked[0]!)!;
    return {
      href: one.href,
      mode: one.mode,
      coveredLegs: one.mode === "betslip" ? 1 : 0,
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
    return "Bet365 does not expose player-prop selection IDs via our odds feed yet — open the match and add legs manually (or use per-leg links below when available).";
  }
  return "Only part of this slip could be deep-linked; add remaining legs manually on Bet365.";
}

export function bet365LegLinkLabel(
  legLink: NonNullable<ReturnType<typeof resolveBet365LegLink>>
): string {
  return legLink.mode === "betslip" ? "Open leg on Bet365" : "Open match on Bet365";
}
