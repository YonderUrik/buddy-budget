/** Query parameters shared by the investments view routes, parsed into options or a coded 400. */
import { startOfDay } from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { apiError } from "@/lib/http";
import type { PortfolioChartPeriod, PortfolioChartRange } from "@/lib/investments/chart-period";
import { INVESTMENTS_VIEW_DEFAULT_PERIOD } from "./investments";
import { parseChartPeriod, parseExcludedBrokers, parseRangeParams, parseTodayParam } from "./params";

export interface InvestmentsQuery {
  today: Date;
  period: PortfolioChartPeriod;
  customRange: PortfolioChartRange | null;
  selection: PortfolioChartRange | null;
  excludedBrokers: Set<string>;
}

/** `today`, `period`, `from`/`to` (custom bounds), `selFrom`/`selTo` (range dragged on the chart), `excludeBrokers`. */
export function parseInvestmentsQuery(request: Request): InvestmentsQuery | Response {
  const params = new URL(request.url).searchParams;
  const parsedToday = parseTodayParam(request);
  if (parsedToday === null) return apiError(400, "invalid_date", "today deve avere formato YYYY-MM-DD", { field: "today" });
  const today = parsedToday ?? startOfDay(new Date());
  const todayKey = toDateKey(today);
  const period = parseChartPeriod(params.get("period"), INVESTMENTS_VIEW_DEFAULT_PERIOD);
  if (!period) return apiError(400, "invalid_period", "period deve essere uno tra 1mese, 3mesi, 1anno, max, ytd, custom", { field: "period" });
  const customRange = parseRangeParams(request, "from", "to", todayKey);
  if (customRange === null) return apiError(400, "invalid_date_range", "from e to devono essere date YYYY-MM-DD, from ≤ to ≤ oggi", { field: "from" });
  if (period === "custom" && !customRange) return apiError(400, "invalid_date_range", "period=custom richiede from e to", { field: "from" });
  const selection = parseRangeParams(request, "selFrom", "selTo", todayKey);
  if (selection === null) return apiError(400, "invalid_date_range", "selFrom e selTo devono essere date YYYY-MM-DD, selFrom ≤ selTo ≤ oggi", { field: "selFrom" });
  return { today, period, customRange: customRange ?? null, selection: selection ?? null, excludedBrokers: parseExcludedBrokers(params.get("excludeBrokers")) };
}
