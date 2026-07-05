import type {
  ArbLeg,
  ArbOpportunity,
  BookmakerId,
  Match,
} from "./types";

/**
 * Finds every arbitrage (guaranteed-profit) opportunity across the given
 * matches, using only the enabled bookmakers.
 *
 * A market is an arb when the sum of inverse best odds across all outcomes
 * is below 1: staking each outcome in proportion to its inverse odds then
 * returns the same payout whichever outcome wins, and that payout exceeds
 * the total stake.
 */
export function findArbs(
  matches: Match[],
  enabled: BookmakerId[]
): ArbOpportunity[] {
  return scanMarkets(matches, enabled).filter((o) => o.impliedTotal < 1);
}

/**
 * The closest-to-arbitrage markets (implied total nearest to 1.0 from
 * above). When no guaranteed window is open these are the markets most
 * likely to tip into profit on the next price move, so they're worth
 * watching. Their profitPct is negative.
 */
export function findNearArbs(
  matches: Match[],
  enabled: BookmakerId[],
  limit = 6
): ArbOpportunity[] {
  return scanMarkets(matches, enabled)
    .filter((o) => o.impliedTotal >= 1)
    .sort((a, b) => a.impliedTotal - b.impliedTotal)
    .slice(0, limit);
}

function scanMarkets(
  matches: Match[],
  enabled: BookmakerId[]
): ArbOpportunity[] {
  const arbs: ArbOpportunity[] = [];

  for (const match of matches) {
    for (const market of match.markets) {
      const legs: ArbLeg[] = [];
      let impliedTotal = 0;
      let valid = true;

      for (const outcome of market.outcomes) {
        let bestOdds = 0;
        let bestBookie: BookmakerId | null = null;
        for (const id of enabled) {
          const o = outcome.odds[id];
          if (o != null && o > bestOdds) {
            bestOdds = o;
            bestBookie = id;
          }
        }
        if (!bestBookie) {
          valid = false;
          break;
        }
        impliedTotal += 1 / bestOdds;
        legs.push({
          outcomeKey: outcome.key,
          outcomeLabel: outcome.label,
          bookmaker: bestBookie,
          odds: bestOdds,
          share: 0, // filled below once impliedTotal is known
        });
      }

      if (!valid) continue;

      for (const leg of legs) {
        leg.share = 1 / leg.odds / impliedTotal;
      }

      arbs.push({
        id: `${match.id}:${market.id}`,
        matchId: match.id,
        matchLabel: `${match.home} v ${match.away}`,
        homeFlag: match.homeFlag,
        awayFlag: match.awayFlag,
        kickoff: match.kickoff,
        stage: match.stage,
        marketId: market.id,
        marketName: market.name,
        marketType: market.type,
        legs,
        impliedTotal,
        profitPct: 1 / impliedTotal - 1,
      });
    }
  }

  return arbs.sort((a, b) => b.profitPct - a.profitPct);
}

export interface StakePlanLeg extends ArbLeg {
  stake: number;
  payout: number;
}

export interface StakePlan {
  legs: StakePlanLeg[];
  totalStaked: number;
  /** Payout if this is exact-split; with rounding, the minimum payout */
  minPayout: number;
  maxPayout: number;
  /** Worst-case profit across all outcomes (guaranteed) */
  guaranteedProfit: number;
  /** Best-case profit across all outcomes */
  maxProfit: number;
  roiPct: number;
}

/**
 * Splits a total stake across the legs of an arb so profit is locked in
 * regardless of the result. `roundTo` (e.g. 1 = whole pounds) rounds each
 * individual stake to look natural at the bookmaker.
 *
 * Rounding is optimised, not naive: every floor/ceil combination across the
 * legs is evaluated and the one with the best worst-case profit wins, so
 * rounding never silently turns an arb into a loss when a profitable
 * rounding exists.
 */
export function buildStakePlan(
  legs: ArbLeg[],
  totalStake: number,
  roundTo: number
): StakePlan {
  const impliedTotal = legs.reduce((sum, l) => sum + 1 / l.odds, 0);
  const exact = legs.map(
    (leg) => (totalStake * (1 / leg.odds)) / impliedTotal
  );

  let stakes: number[];
  if (roundTo <= 0) {
    stakes = exact.map((e) => Math.round(e * 100) / 100);
  } else {
    const options = exact.map((e) => {
      const lo = Math.max(roundTo, Math.floor(e / roundTo) * roundTo);
      const hi = Math.max(roundTo, Math.ceil(e / roundTo) * roundTo);
      return lo === hi ? [lo] : [lo, hi];
    });

    let best: number[] | null = null;
    let bestProfit = -Infinity;
    const combos = options.reduce((n, o) => n * o.length, 1);
    for (let mask = 0; mask < combos; mask++) {
      let m = mask;
      const candidate: number[] = [];
      for (const opt of options) {
        candidate.push(opt[m % opt.length]);
        m = Math.floor(m / opt.length);
      }
      const total = candidate.reduce((s, x) => s + x, 0);
      const worst = Math.min(...candidate.map((s, i) => s * legs[i].odds));
      const profit = worst - total;
      if (profit > bestProfit) {
        bestProfit = profit;
        best = candidate;
      }
    }
    stakes = best ?? exact;
  }

  const planLegs: StakePlanLeg[] = legs.map((leg, i) => ({
    ...leg,
    stake: stakes[i],
    payout: stakes[i] * leg.odds,
  }));

  const totalStaked = planLegs.reduce((s, l) => s + l.stake, 0);
  const payouts = planLegs.map((l) => l.payout);
  const minPayout = Math.min(...payouts);
  const maxPayout = Math.max(...payouts);
  const guaranteedProfit = minPayout - totalStaked;

  return {
    legs: planLegs,
    totalStaked,
    minPayout,
    maxPayout,
    guaranteedProfit,
    maxProfit: maxPayout - totalStaked,
    roiPct: totalStaked > 0 ? guaranteedProfit / totalStaked : 0,
  };
}
