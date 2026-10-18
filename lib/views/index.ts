/**
 * lib/views — server-computed views for the native apps (and, later, the web): each one runs the same pure functions
 * the web screens run in the browser (ADR 0002 of the mobile spec). This barrel exports the pure builders, the query
 * parameter helpers and the zod response schemas; the database loaders are in `lib/views/server`.
 */
export { buildOverviewView, OVERVIEW_DEFAULT_PERIOD, OVERVIEW_INVESTMENTS_PERIOD, type OverviewInputs } from "./overview";
export { buildLiquidityMonth, type LiquidityMonthInputs } from "./liquidity-month";
export { ACCOUNT_TREND_DAYS, accountTrendFrom, buildAccountExtras, type AccountExtrasInput } from "./accounts";
export { ACCOUNT_INCLUDES, parseAccountIncludes, parseNetWorthPeriod, parseTodayParam, type AccountInclude } from "./params";
export {
  accountExtrasSchema,
  accountHealthSchema,
  liquidityMonthSchema,
  monthPaceSchema,
  overviewViewSchema,
  renewalAlertSchema,
  transactionPageSchema,
  voiceLineSchema,
  type AccountExtras,
  type AccountHealth,
  type LiquidityMonth,
  type OverviewView,
  type TransactionPage,
} from "./schemas";
