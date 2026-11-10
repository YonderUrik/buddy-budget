import "server-only";
import type { PortfolioChartPeriod, PortfolioChartRange } from "@/lib/investments/chart-period";
import { resolveProfile } from "@/lib/localization/config";
import { buildInvestmentsPerformance, buildInvestmentsViewData } from "./investments";
import { loadInvestmentViewData } from "./investments-data.server";
import { buildInvestmentsIncome, buildInvestmentsTaxes, simulateInvestmentSale, type SaleSimulationRequest } from "./investments-tax";

type ViewUser = { id: string; productCountry?: string | null; language?: string | null };

interface ViewOptions {
  today: Date;
  period: PortfolioChartPeriod;
  customRange: PortfolioChartRange | null;
  excludedBrokers: ReadonlySet<string>;
}

/** `GET /api/investments/view` for a user. */
export async function loadInvestmentsView(user: ViewUser, options: ViewOptions) {
  const { all, data } = await loadInvestmentViewData(user.id, options.excludedBrokers);
  return buildInvestmentsViewData({ ...options, language: resolveProfile(user).language, all, data });
}

/** `GET /api/investments/performance` for a user. */
export async function loadInvestmentsPerformance(user: ViewUser, options: ViewOptions & { selection: PortfolioChartRange | null }) {
  const { all, data } = await loadInvestmentViewData(user.id, options.excludedBrokers);
  return buildInvestmentsPerformance({ ...options, language: resolveProfile(user).language, all, data });
}

/** `GET /api/investments/income` for a user: Italy with taxes, «Altro paese» before tax (Germany has its own income section). */
export async function loadInvestmentsIncome(userId: string, options: { today: Date; excludedBrokers: ReadonlySet<string>; taxes: boolean }) {
  const { data } = await loadInvestmentViewData(userId, options.excludedBrokers);
  return buildInvestmentsIncome(data, options.today, { taxes: options.taxes });
}

/** `GET /api/investments/taxes` for a user (Italy). */
export async function loadInvestmentsTaxes(userId: string, options: { today: Date; excludedBrokers: ReadonlySet<string> }) {
  const { data } = await loadInvestmentViewData(userId, options.excludedBrokers);
  return buildInvestmentsTaxes(data, options.today);
}

/** `POST /api/investments/taxes/simulate-sale` for a user (Italy): no writes. */
export async function runSaleSimulation(user: ViewUser, options: { today: Date; excludedBrokers: ReadonlySet<string>; request: SaleSimulationRequest }) {
  const { data } = await loadInvestmentViewData(user.id, options.excludedBrokers);
  return simulateInvestmentSale(data, options.today, options.request, resolveProfile(user).language);
}
