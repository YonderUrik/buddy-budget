import { parseDateOnly } from "@/lib/calc/expenses";
import { toDateKey, type NetWorthPeriod } from "@/lib/calc/net-worth";

export type PortfolioChartPeriod = NetWorthPeriod | "ytd" | "custom";
export interface PortfolioChartRange { from: string; to: string }

/** Validate inclusive calendar dates without accepting rollover or future dates. */
export function validChartRange(range: PortfolioChartRange, today: string): boolean {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toDateKey(parseDateOnly(value)) === value;
  return valid(range.from) && valid(range.to) && range.from <= range.to && range.to <= today;
}

/** Resolve YTD or explicit chart bounds; preset periods keep their existing calculation. */
export function portfolioChartRange(period: PortfolioChartPeriod, custom: PortfolioChartRange, today: string): PortfolioChartRange | undefined {
  if (period === "ytd") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return period === "custom" && validChartRange(custom, today) ? custom : undefined;
}
