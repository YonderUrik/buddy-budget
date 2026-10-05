/**
 * components/domain/expenses — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Transazioni (ex Spese).
 * Importa da qui invece che dai singoli file per isolare i refactor interni.
 *
 * Esempio:
 *   import {
 *     ExpensesPeriodSelector,
 *     ExpensesKpiCards,
 *     TransactionRow,
 *   } from "@/components/domain/expenses";
 */

export { ExpensesPeriodSelector } from "./expenses-period-selector";
export type { ExpensesPeriodSelectorProps } from "./expenses-period-selector";
export { ExpensesFilterBar } from "./expenses-filter-bar";
export type { ExpensesFilterBarProps } from "./expenses-filter-bar";
export { ExpensesReferenceNav } from "./expenses-reference-nav";
export type { ExpensesReferenceNavProps } from "./expenses-reference-nav";
export { CategoryBreakdownDonut } from "./category-breakdown-donut";
export type { CategoryBreakdownDonutProps } from "./category-breakdown-donut";
export { ExpenseTrendChart } from "./expense-trend-chart";
export type { ExpenseTrendChartProps } from "./expense-trend-chart";
export { TransactionRow } from "./transaction-row";
export type { TransactionRowProps } from "./transaction-row";
export { SplitSlider } from "./split-slider";
export type { SplitSliderProps } from "./split-slider";
export { AddTransactionForm } from "./add-transaction-form";
export type { AddTransactionFormProps } from "./add-transaction-form";
export { TransactionsTypeToggle } from "./transactions-type-toggle";
export type { TransactionsTypeToggleProps } from "./transactions-type-toggle";
export { TransactionsPeriodSummary } from "./transactions-period-summary";
export type { TransactionsPeriodSummaryProps } from "./transactions-period-summary";
export { UncategorizedCallout } from "./uncategorized-callout";
export type { UncategorizedCalloutProps } from "./uncategorized-callout";
export { TransactionEditPanel } from "./transaction-edit-panel";
export type { TransactionEditPanelProps } from "./transaction-edit-panel";
export { TransactionDetailSheet } from "./transaction-detail-sheet";
export type { TransactionDetailSheetProps, TransactionDetailFocus } from "./transaction-detail-sheet";
export { TransactionsDayHeader } from "./transactions-day-header";
export type { TransactionsDayHeaderProps } from "./transactions-day-header";
export { SwipeHint, dismissSwipeHint } from "./swipe-hint";
export { useSwipeReveal } from "./use-swipe-reveal";
export type { SwipeReveal, SwipeSide, UseSwipeRevealOptions } from "./use-swipe-reveal";
export { MovementsQuickFilters } from "./movements-quick-filters";
export type { MovementsQuickFiltersProps } from "./movements-quick-filters";
