/**
 * components/domain/debts — barrel file
 *
 * Schermata Debiti: schede, panoramica e finanziamenti.
 */

export { DEBTS_TABS } from "./debts-tabs";
export type { DebtsTab } from "./debts-tabs";
export { DebtsActionsProvider, useDebtsActions } from "./debts-actions";
export type { DebtsActions } from "./debts-actions";
export { DebtsViewGate } from "./debts-view-gate";
export type { DebtsViewGateProps } from "./debts-view-gate";
export { DebtsSummaryCard } from "./debts-summary-card";
export type { DebtsSummaryCardProps } from "./debts-summary-card";
export { DebtsResidualChartCard } from "./debts-residual-chart-card";
export type { DebtsResidualChartCardProps } from "./debts-residual-chart-card";
export { DebtsNextDueCard } from "./debts-next-due-card";
export type { DebtsNextDueCardProps } from "./debts-next-due-card";
export { formatMonthYear, summarySentence } from "./debts-format";
