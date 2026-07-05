export type OddsFormat = "decimal" | "fractional";
export type Currency = "GBP" | "EUR";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
};

/** Common fractional prices used on UK/Irish bookmaker ladders */
const FRACTION_LADDER: Array<[number, number]> = [
  [1, 100], [1, 80], [1, 66], [1, 50], [1, 40], [1, 33], [1, 25], [1, 20], [1, 16], [1, 14], [1, 12], [1, 10], [1, 8], [1, 7], [1, 6], [1, 5], [2, 9], [1, 4],
  [2, 7], [3, 10], [1, 3], [4, 11], [2, 5], [4, 9], [1, 2], [8, 15], [4, 7],
  [8, 13], [4, 6], [8, 11], [4, 5], [5, 6], [10, 11], [1, 1], [11, 10],
  [6, 5], [5, 4], [11, 8], [7, 5], [6, 4], [8, 5], [13, 8], [7, 4], [9, 5],
  [15, 8], [2, 1], [11, 5], [9, 4], [12, 5], [5, 2], [13, 5], [11, 4], [3, 1],
  [16, 5], [10, 3], [7, 2], [4, 1], [9, 2], [5, 1], [11, 2], [6, 1], [13, 2],
  [7, 1], [15, 2], [8, 1], [17, 2], [9, 1], [10, 1], [11, 1], [12, 1],
  [14, 1], [16, 1], [18, 1], [20, 1], [25, 1], [33, 1], [40, 1], [50, 1],
  [66, 1], [80, 1], [100, 1],
];

export function toFractional(decimal: number): string {
  const target = decimal - 1;
  let best = FRACTION_LADDER[0];
  let bestDiff = Infinity;
  for (const [n, d] of FRACTION_LADDER) {
    const diff = Math.abs(n / d - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [n, d];
    }
  }
  return `${best[0]}/${best[1]}`;
}

export function formatOdds(decimal: number, format: OddsFormat): string {
  if (format === "fractional") return toFractional(decimal);
  return decimal.toFixed(2);
}

export function formatMoney(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOL[currency];
  const sign = amount < 0 ? "-" : "";
  return `${sign}${sym}${Math.abs(amount).toFixed(2)}`;
}

export function formatPct(fraction: number, dp = 2): string {
  return `${(fraction * 100).toFixed(dp)}%`;
}

export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayLabel(offset: number, date: Date): string {
  const weekday = date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (offset === 0) return `Today · ${weekday}`;
  if (offset === 1) return `Tomorrow · ${weekday}`;
  return weekday;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function dayOffsetOf(iso: string, now: Date): number {
  const target = startOfLocalDay(new Date(iso)).getTime();
  const today = startOfLocalDay(now).getTime();
  return Math.round((target - today) / 86_400_000);
}
