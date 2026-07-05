# DKBets — World Cup Arbitrage Finder

Real-time World Cup 2026 odds comparison across **12 live bookmakers**, with
automatic detection of matched-betting (arbitrage) opportunities that lock in
profit regardless of the result.

## Live data sources (no third-party paid APIs)

| Source | Bookmakers | Markets | How |
| --- | --- | --- | --- |
| Coral official OpenBet feed | Coral | Match Result, To Qualify, BTTS, O/U 2.5 | `ss-aka-ori.coral.co.uk` JSON (same feed their site uses) |
| BoyleSports official feed | BoyleSports | Match Result, To Qualify, BTTS, O/U 2.5 | `cache.boylesports.com/feeds/INTFOOTBALL.json` |
| Oddsscanner (server-rendered) | Bet365, BetVictor, BetMGM, Midnite, BetUK, 10bet, LeoVegas, Virgin Bet, NetBet, Highbet | Match Result | parsed from each match page's comparison table |

Unavailable (they block all automated access, so showing their prices would
require a licensed feed): **Paddy Power, Novibet, Sky Bet** — shown greyed-out
in the UI with the reason.

Each source is cached server-side (bookmaker feeds 15s, Oddsscanner 60s) and
merged by normalised team names; the client polls every 10s. If every live
source fails, a clearly-labelled simulation keeps the UI functional.

## Features

- **Live odds board** — every fixture and market compared across all books,
  best price highlighted, cells flash green/red as prices move.
- **Arbitrage detection** — any market where the sum of inverse best odds
  drops below 1.00 is flagged instantly with its guaranteed return.
- **Standout Picks** — the best guaranteed returns per match day
  (Today / Tomorrow / +2 / +3), rolling forward automatically.
- **Near-Arb Watchlist** — the markets closest to tipping into profit, so you
  can see windows about to open (real arbs are rare and short-lived).
- **Stake Splitter** — total stake split across bookmakers so every outcome
  pays the same. Stake rounding searches all floor/ceil combinations for the
  best worst-case profit; includes copyable bet slip and bookmaker links.
- **Arb alerts** — toasts + optional desktop notifications when a new
  opportunity above 1% opens.
- Bookmaker filters, decimal/fractional odds, £/€ toggle, execution & risk
  guide.

## Running

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

## How the maths works

For a market with outcomes at best odds `o1..on`, compute `T = Σ 1/oi`.
If `T < 1`, staking `S · (1/oi)/T` on each outcome returns `S/T` whichever
outcome wins — a guaranteed profit of `S(1/T − 1)`.

## Disclaimer

This is an analysis tool; it does not accept bets. Odds can change between
display and placement — always confirm prices on the bookmaker's own slip.
Bookmakers may restrict accounts that arb consistently and can void bets
placed at palpable-error prices. 18+ · [GambleAware.org](https://www.gambleaware.org)
