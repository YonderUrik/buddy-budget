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
export { EarlyRepaymentDialog } from "./early-repayment-dialog";
export type { EarlyRepaymentDialogProps } from "./early-repayment-dialog";
export { EarlyRepaymentCompare, EarlyRepaymentMonthly } from "./early-repayment-compare";
export type { EarlyRepaymentCompareProps, EarlyRepaymentMonthlyProps } from "./early-repayment-compare";
export { AddDebtKindStep, KIND_OPTIONS } from "./add-debt-kind-step";
export type { AddDebtKind, AddDebtKindStepProps } from "./add-debt-kind-step";
export { AddCreditLineForm } from "./add-credit-line-form";
export type { AddCreditLineFormProps } from "./add-credit-line-form";
export { CreditLineFormFields } from "./credit-line-form-fields";
export type { CreditLineFormFieldsProps } from "./credit-line-form-fields";
export { CreditLineSettingsDialog } from "./credit-line-settings-dialog";
export type { CreditLineSettingsDialogProps } from "./credit-line-settings-dialog";
export { CreditLineSelector } from "./credit-line-selector";
export type { CreditLineSelectorProps } from "./credit-line-selector";
export { CreditLineDetail } from "./credit-line-detail";
export type { CreditLineDetailProps } from "./credit-line-detail";
export { CreditLineUsage, thresholdPosition, usageAlertText } from "./credit-line-usage";
export type { CreditLineUsageProps } from "./credit-line-usage";
export { CreditLineFacts } from "./credit-line-facts";
export type { CreditLineFactsProps } from "./credit-line-facts";
export { CreditLineChart } from "./credit-line-chart";
export type { CreditLineChartProps } from "./credit-line-chart";
export { CreditLineCharges, CHARGES_VISIBLE } from "./credit-line-charges";
export type { CreditLineChargesProps } from "./credit-line-charges";
export { DebtsCreditLinesCard } from "./debts-credit-lines-card";
export type { DebtsCreditLinesCardProps } from "./debts-credit-lines-card";
