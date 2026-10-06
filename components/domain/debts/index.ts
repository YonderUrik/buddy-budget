/**
 * components/domain/debts — barrel file
 *
 * Schermata Debiti: panoramica (prossime rate, interessi, piano per uscirne), dettaglio dei finanziamenti con simulazione.
 */

export { DebtsActionsProvider, useDebtsActions } from "./debts-actions";
export type { DebtsActions } from "./debts-actions";
export { DebtsViewGate } from "./debts-view-gate";
export type { DebtsViewGateProps } from "./debts-view-gate";
export { formatDuration, formatMonthYear } from "./debts-format";
export { DebtsUpcomingCard, dueText, daysBetween } from "./debts-upcoming-card";
export type { DebtsUpcomingCardProps } from "./debts-upcoming-card";
export { DebtsInterestCard } from "./debts-interest-card";
export type { DebtsInterestCardProps } from "./debts-interest-card";
export { DebtsExitCard } from "./debts-exit-card";
export type { DebtsExitCardProps } from "./debts-exit-card";
export { DebtsListCard } from "./debts-list-card";
export type { DebtsListCardProps } from "./debts-list-card";
export { DebtRing } from "./debt-ring";
export type { DebtRingProps } from "./debt-ring";
export { DebtSimulationPanel } from "./debt-simulation-panel";
export type { DebtSimulationPanelProps } from "./debt-simulation-panel";
export { DebtExtraSim } from "./debt-extra-sim";
export { DebtRefinanceSim } from "./debt-refinance-sim";
export { DebtFacts, repaidShare } from "./debt-facts";
export type { DebtFactsProps } from "./debt-facts";
export { DebtDetail } from "./debt-detail";
export type { DebtDetailProps } from "./debt-detail";
export { DebtPlanTable, visibleRowRange } from "./debt-plan-table";
export type { DebtPlanTableProps } from "./debt-plan-table";
export { PayInstallmentDialog } from "./pay-installment-dialog";
export type { PayInstallmentDialogProps } from "./pay-installment-dialog";
export { DebtEventDialog } from "./debt-event-dialog";
export type { DebtEventDialogKind, DebtEventDialogProps } from "./debt-event-dialog";
export { AddDebtDialog } from "./add-debt-dialog";
export type { AddDebtDialogProps } from "./add-debt-dialog";
export { EarlyRepaymentDialog } from "./early-repayment-dialog";
export type { EarlyRepaymentDialogProps } from "./early-repayment-dialog";
export { EarlyRepaymentCompare, EarlyRepaymentMonthly } from "./early-repayment-compare";
export type { EarlyRepaymentCompareProps, EarlyRepaymentMonthlyProps } from "./early-repayment-compare";
