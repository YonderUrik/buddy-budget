/**
 * components/domain/investments — barrel file
 *
 * Componenti della schermata Investimenti.
 */

export { InvestmentsKpiCards } from "./investments-kpi-cards";
export type { InvestmentsKpiCardsProps } from "./investments-kpi-cards";
export { PortfolioChartCard } from "./portfolio-chart-card";
export type { PortfolioChartCardProps } from "./portfolio-chart-card";
export { PortfolioComposition } from "./portfolio-composition";
export type { CompositionGroup, PortfolioCompositionProps } from "./portfolio-composition";
export { PositionsList, STALE_PRICE_DAYS } from "./positions-list";
export type { PositionsListProps } from "./positions-list";
export { InvestmentTransactionsList, RECENT_TRANSACTIONS_LIMIT } from "./investment-transactions-list";
export type { InvestmentTransactionsListProps } from "./investment-transactions-list";
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
