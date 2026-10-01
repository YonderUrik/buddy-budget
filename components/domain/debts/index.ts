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
export { DebtsCostCard, sortByCost, COST_REFERENCE_AMOUNT } from "./debts-cost-card";
export type { DebtsCostCardProps } from "./debts-cost-card";
export { DebtsTimelineCard } from "./debts-timeline-card";
export type { DebtsTimelineCardProps } from "./debts-timeline-card";
export { DebtsNextDueCard } from "./debts-next-due-card";
export type { DebtsNextDueCardProps } from "./debts-next-due-card";
export { formatMonthYear, summarySentence } from "./debts-format";
export { DebtSelector, repaidShare } from "./debt-selector";
export type { DebtSelectorProps } from "./debt-selector";
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
