/**
 * components/domain/investments — barrel file
 *
 * Componenti della schermata Investimenti.
 */

export { PortfolioHeroCard } from "./portfolio-hero-card";
export type { PortfolioHeroCardProps } from "./portfolio-hero-card";
export { ValueBreakdownBar } from "./value-breakdown-bar";
export type { ValueBreakdownBarProps } from "./value-breakdown-bar";
export { INSTRUMENT_TYPE_COLOR, CURRENCY_COLORS } from "./instrument-colors";
export { PortfolioComposition } from "./portfolio-composition";
export type { CompositionGroup, PortfolioCompositionProps } from "./portfolio-composition";
export { PositionsList, STALE_PRICE_DAYS } from "./positions-list";
export type { PositionsListProps } from "./positions-list";
export { InvestmentTransactionsList, RECENT_OPERATION_MONTHS_LIMIT } from "./investment-transactions-list";
export type { InvestmentTransactionsListProps } from "./investment-transactions-list";
export { OperationMonthGroup } from "./operation-month-group";
export type { OperationMonthGroupProps } from "./operation-month-group";
export { OperationRow } from "./operation-row";
export type { OperationRowProps } from "./operation-row";
export { OperationsTotals } from "./operations-totals";
export type { OperationsTotalsProps } from "./operations-totals";
export { GainText, formatSignedCurrency, formatSignedPct } from "./gain-text";
export type { GainTextProps } from "./gain-text";
export { InstrumentPicker } from "./instrument-picker";
export type { InstrumentPickerProps } from "./instrument-picker";
export { InstrumentManualForm } from "./instrument-manual-form";
export type { InstrumentManualFormProps } from "./instrument-manual-form";
export { RegisterOperationForm } from "./register-operation-form";
export type { RegisterOperationFormProps, RegisterOperationInitial } from "./register-operation-form";
export { PlansCard } from "./plans-card";
export type { PlansCardProps } from "./plans-card";
export { ManualPriceDialog } from "./manual-price-dialog";
export type { ManualPriceDialogProps } from "./manual-price-dialog";
export { prefillFromPlan } from "./register-operation-form.state";
export { InvestmentImportDialog } from "./import/investment-import-dialog";
export type { InvestmentImportDialogProps } from "./import/investment-import-dialog";
export { ReturnsCard } from "./returns-card";
export type { ReturnsCardProps } from "./returns-card";
export { ReturnsChart } from "./returns-chart";
export type { ReturnsChartProps } from "./returns-chart";
export { ReturnMetric } from "./return-metric";
export type { ReturnMetricProps } from "./return-metric";
export { BenchmarkSummary } from "./benchmark-summary";
export type { BenchmarkSummaryProps } from "./benchmark-summary";
export { BenchmarkDialog } from "./benchmark-dialog";
export type { BenchmarkDialogProps } from "./benchmark-dialog";
export { IncomeHistoryCard } from "./income-history-card";
export type { IncomeHistoryCardProps } from "./income-history-card";
