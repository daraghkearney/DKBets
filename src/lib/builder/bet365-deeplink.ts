import type { BuilderLeg } from "./types";

export const BET365_REDIRECT_BASE =
  "https://www.bet365.com/dl/sportsbookredirect?bet=1&bs=";

const ROW_LINK_KEYS = [
  "link",
  "url",
  "href",
  "deepLink",
  "deep_link",
  "betLink",
  "overLink",
  "underLink",
  "yesLink",
  "noLink",
  "homeLink",
  "awayLink",
  "drawLink",
] as const;

const SELECTION_ID_KEYS = [
  "selectionId",
  "selection_id",
  "sid",
  "fid",
  "bs",
] as const;

/** Bet365 sportsbookredirect tokens use eventId-marketId (see slip-mate / TP=BS pattern). */
export function parseBet365SelectionPair(
  raw: string | undefined
): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/(\d{6,})-(\d{6,})/);
  return match ? `${match[1]}-${match[2]}` : undefined;
}

export function parseBet365SelectionFromUrl(
  url: string | undefined
): string | undefined {
  if (!url || !url.startsWith("http")) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.includes("sportsbookredirect")) {
      const bs = parsed.searchParams.get("bs");
      if (bs) {
        const decoded = decodeURIComponent(bs);
        const match = decoded.match(/\|?(\d+-\d+)~/);
        if (match) return match[1];
      }
    }
    const tpMatch = url.match(/TP=BS(\d+)-(\d+)/i);
    if (tpMatch) return `${tpMatch[1]}-${tpMatch[2]}`;
    return parseBet365SelectionPair(url);
  } catch {
    return undefined;
  }
}

export function extractBet365RowLink(
  row: Record<string, unknown>,
  market?: Record<string, unknown>
): string | undefined {
  for (const key of ROW_LINK_KEYS) {
    const value = row?.[key];
    if (typeof value === "string" && value.startsWith("http")) return value;
  }
  if (market) {
    for (const key of ROW_LINK_KEYS) {
      const value = market[key];
      if (typeof value === "string" && value.startsWith("http")) return value;
    }
  }
  return undefined;
}

export function extractBet365SelectionId(
  row: Record<string, unknown>,
  apiEventId?: number,
  link?: string
): string | undefined {
  for (const key of SELECTION_ID_KEYS) {
    const value = row?.[key];
    if (typeof value === "string") {
      const parsed = parseBet365SelectionPair(value);
      if (parsed) return parsed;
    }
  }

  const fromLink = parseBet365SelectionFromUrl(link);
  if (fromLink) return fromLink;

  const eventId = row?.eventId ?? row?.event_id ?? apiEventId;
  const marketId = row?.marketId ?? row?.market_id ?? row?.mid ?? row?.oid;
  if (eventId != null && marketId != null) {
    return `${eventId}-${marketId}`;
  }

  const id = row?.id;
  if (typeof id === "string") {
    const parsed = parseBet365SelectionPair(id);
    if (parsed) return parsed;
  }
  if (typeof id === "number" && apiEventId != null) {
    return `${apiEventId}-${id}`;
  }

  return undefined;
}

/** Build the raw bs payload for sportsbookredirect (pipe-separated legs). */
export function buildBet365RedirectBs(
  legs: Pick<BuilderLeg, "bet365SelectionId" | "fractionalOdds">[]
): string | null {
  if (!legs.length) return null;
  if (!legs.every((leg) => leg.bet365SelectionId)) return null;
  return legs.map((leg) => `|${leg.bet365SelectionId}~${leg.fractionalOdds}`).join("");
}

export function buildBet365RedirectUrl(
  legs: Pick<BuilderLeg, "bet365SelectionId" | "fractionalOdds">[]
): string | null {
  const bs = buildBet365RedirectBs(legs);
  if (!bs) return null;
  return `${BET365_REDIRECT_BASE}${encodeURIComponent(bs)}`;
}

export function resolveBet365LegLink(
  leg: BuilderLeg
): { href: string; mode: "betslip" | "event" } | null {
  const redirect = buildBet365RedirectUrl([leg]);
  if (redirect) return { href: redirect, mode: "betslip" };
  if (leg.bet365Link) return { href: leg.bet365Link, mode: "betslip" };
  if (leg.bet365EventUrl) return { href: leg.bet365EventUrl, mode: "event" };
  return null;
}

export function countBet365DeeplinkQuotes(
  quotes: Iterable<{ link?: string; selectionId?: string }>
): { total: number; withMeta: number } {
  let total = 0;
  let withMeta = 0;
  for (const quote of quotes) {
    total += 1;
    if (quote.link || quote.selectionId) withMeta += 1;
  }
  return { total, withMeta };
}
