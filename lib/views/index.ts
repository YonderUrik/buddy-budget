/**
 * lib/views — server-computed views for the native apps (and, later, the web): each one runs the same pure functions
 * the web screens run in the browser (ADR 0002 of the mobile spec). This barrel exports the pure builders, the query
 * parameter helpers and the zod response schemas; the database loaders are in `lib/views/server`.
 */
export { buildOverviewView, OVERVIEW_DEFAULT_PERIOD, OVERVIEW_INVESTMENTS_PERIOD, type OverviewInputs } from "./overview";
export { buildLiquidityMonth, type LiquidityMonthInputs } from "./liquidity-month";
export { ANALYSIS_PERIODS, buildLiquidityAnalysis, type LiquidityAnalysisInputs } from "./liquidity-analysis";
export { ACCOUNT_TREND_DAYS, accountTrendFrom, buildAccountExtras, type AccountExtrasInput } from "./accounts";
export { ACCOUNT_INCLUDES, parseAccountIncludes, parseChartPeriod, parseDateParam, parseExcludedBrokers, parseExpensePeriod, parseNetWorthPeriod, parseRangeParams, parseTodayParam, type AccountInclude } from "./params";
export {
  buildInvestmentsPerformance,
  buildInvestmentsViewData,
  HEATMAP_GROUPINGS,
  INSPECT_MAX_POINTS,
  INVESTMENTS_VIEW_DEFAULT_PERIOD,
  PORTFOLIO_CHART_PERIODS,
  sampleIndexes,
  type InvestmentsPerformance,
  type InvestmentsViewData,
  type InvestmentsViewInputs,
} from "./investments";
export { buildAnalyticsView, type AnalyticsView, type AnalyticsViewInputs } from "./analytics";
export { buildPlanningResults, PLANNING_CURRENCY, type PlanningResults } from "./financial-planning";
export { buildAppMeta, buildWhatsNew, type AppMeta, type AppMetaInputs, type WhatsNew, type WhatsNewInputs } from "./meta";
export { buildPensionView, type PensionView, type PensionViewInputs } from "./pension";
export { buildInvestmentsIncome, buildInvestmentsTaxes, simulateInvestmentSale, type InvestmentsIncome, type InvestmentsTaxes, type SaleSimulationRequest, type SaleSimulationResult } from "./investments-tax";
export {
  investmentsIncomeSchema,
  investmentsPerformanceSchema,
  investmentsTaxesSchema,
  investmentsViewSchema,
  saleSimulationRequestSchema,
  saleSimulationSchema,
} from "./investments-schemas";
export {
  accountExtrasSchema,
  accountHealthSchema,
  analyticsViewSchema,
  appMetaSchema,
  bankConnectionAccountsSchema,
  bankConnectionCompletedSchema,
  bankConnectionStartSchema,
  debtsInsightsSchema,
  liquidityAnalysisSchema,
  liquidityMonthSchema,
  monthPaceSchema,
  overviewViewSchema,
  pensionViewSchema,
  renewalAlertSchema,
  transactionPageSchema,
  voiceLineSchema,
  whatsNewSchema,
  type AccountExtras,
  type AccountHealth,
  type LiquidityAnalysis,
  type LiquidityMonth,
  type OverviewView,
  type TransactionPage,
} from "./schemas";
