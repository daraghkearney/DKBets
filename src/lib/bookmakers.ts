import type { Bookmaker, BookmakerId } from "./types";

/**
 * Data-source reality per bookmaker (verified 5 Jul 2026):
 *
 * - Coral        → official OpenBet site-server JSON feed, all markets. LIVE.
 * - BoyleSports  → official cache.boylesports.com JSON feed, all markets. LIVE.
 * - Bet365       → own site is Cloudflare-blocked; real prices come through
 *                  Oddsscanner's server-rendered data (match result). LIVE.
 * - Paddy Power  → site + smp API are Cloudflare-blocked server-side; no
 *                  public feed. UNAVAILABLE (needs a licensed feed).
 * - Novibet      → site + API return 403 outside a browser. UNAVAILABLE.
 * - Sky Bet      → prices render client-side only; no accessible feed yet.
 * - Extra books (BetVictor, BetMGM, Midnite, BetUK, 10bet, LeoVegas,
 *   Virgin Bet, NetBet, Highbet) → real prices via Oddsscanner (match
 *   result market), which widens the arbitrage search considerably.
 */
export const BOOKMAKERS: Bookmaker[] = [
  {
    id: "bet365",
    name: "Bet365",
    shortName: "365",
    color: "#126e51",
    textColor: "#ffe000",
    url: "https://www.bet365.com",
    tier: "primary",
    available: true,
    coverage: "match_result",
    note: "Live via Oddsscanner (match result market)",
  },
  {
    id: "coral",
    name: "Coral",
    shortName: "COR",
    color: "#0053a0",
    textColor: "#ffffff",
    url: "https://www.coral.co.uk/en/sports",
    tier: "primary",
    available: true,
    coverage: "full",
    note: "Live via Coral's own odds feed — all markets",
  },
  {
    id: "boylesports",
    name: "BoyleSports",
    shortName: "BS",
    color: "#c8102e",
    textColor: "#ffffff",
    url: "https://www.boylesports.com",
    tier: "primary",
    available: true,
    coverage: "full",
    note: "Live via BoyleSports' own odds feed — all markets",
  },
  {
    id: "paddypower",
    name: "Paddy Power",
    shortName: "PP",
    color: "#004833",
    textColor: "#ffffff",
    url: "https://www.paddypower.com/bet",
    tier: "primary",
    available: false,
    coverage: "none",
    note: "Blocks all automated access (Cloudflare) — no public feed",
  },
  {
    id: "novibet",
    name: "Novibet",
    shortName: "NOV",
    color: "#1b1f3b",
    textColor: "#4fc3f7",
    url: "https://www.novibet.ie/sports",
    tier: "primary",
    available: false,
    coverage: "none",
    note: "Blocks all automated access (403) — no public feed",
  },
  {
    id: "skybet",
    name: "Sky Bet",
    shortName: "SKY",
    color: "#001b64",
    textColor: "#ffffff",
    url: "https://skybet.com",
    tier: "primary",
    available: false,
    coverage: "none",
    note: "Prices render client-side only — no accessible feed yet",
  },
  // --- Extra books picked up live from Oddsscanner (match result) ---
  { id: "betvictor", name: "BetVictor", shortName: "BV", color: "#1d252d", textColor: "#ffffff", url: "https://www.betvictor.com", tier: "extra", available: true, coverage: "match_result" },
  { id: "betmgm", name: "BetMGM", shortName: "MGM", color: "#8a6d1e", textColor: "#ffffff", url: "https://www.betmgm.co.uk", tier: "extra", available: true, coverage: "match_result" },
  { id: "midnite", name: "Midnite", shortName: "MID", color: "#3d2f8f", textColor: "#ffffff", url: "https://www.midnite.com", tier: "extra", available: true, coverage: "match_result" },
  { id: "betuk", name: "BetUK", shortName: "BUK", color: "#0a0a0a", textColor: "#f4c20d", url: "https://www.betuk.com", tier: "extra", available: true, coverage: "match_result" },
  { id: "tenbet", name: "10bet", shortName: "10B", color: "#0d4da1", textColor: "#ffffff", url: "https://www.10bet.co.uk", tier: "extra", available: true, coverage: "match_result" },
  { id: "leovegas", name: "LeoVegas", shortName: "LEO", color: "#f1690d", textColor: "#ffffff", url: "https://www.leovegas.com", tier: "extra", available: true, coverage: "match_result" },
  { id: "virginbet", name: "Virgin Bet", shortName: "VB", color: "#e10a0a", textColor: "#ffffff", url: "https://www.virginbet.com", tier: "extra", available: true, coverage: "match_result" },
  { id: "netbet", name: "NetBet", shortName: "NB", color: "#14805e", textColor: "#ffffff", url: "https://www.netbet.co.uk", tier: "extra", available: true, coverage: "match_result" },
  { id: "highbet", name: "Highbet", shortName: "HB", color: "#031135", textColor: "#ffffff", url: "https://www.highbet.co.uk", tier: "extra", available: true, coverage: "match_result" },
];

export const AVAILABLE_BOOKMAKERS = BOOKMAKERS.filter((b) => b.available);
export const BOOKMAKER_IDS = AVAILABLE_BOOKMAKERS.map((b) => b.id);

export const BOOKMAKER_MAP: Record<BookmakerId, Bookmaker> = Object.fromEntries(
  BOOKMAKERS.map((b) => [b.id, b])
);

/** Maps bookmaker display names seen in Oddsscanner data to our ids */
export const ODDSSCANNER_NAME_MAP: Record<string, BookmakerId> = {
  Bet365: "bet365",
  BetVictor: "betvictor",
  BetMGM: "betmgm",
  Midnite: "midnite",
  BetUK: "betuk",
  "10bet": "tenbet",
  LeoVegas: "leovegas",
  "Virgin Bet": "virginbet",
  NetBet: "netbet",
  Highbet: "highbet",
};
