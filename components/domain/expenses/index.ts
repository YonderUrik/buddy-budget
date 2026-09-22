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
export { ExpensesKpiCards } from "./expenses-kpi-cards";
export type { ExpensesKpiCardsProps } from "./expenses-kpi-cards";
export { IncomeKpiCards } from "./income-kpi-cards";
export type { IncomeKpiCardsProps } from "./income-kpi-cards";
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
export { AutoCategorizeButton } from "./auto-categorize-button";
export { TransactionsTypeToggle } from "./transactions-type-toggle";
export type { TransactionsTypeToggleProps } from "./transactions-type-toggle";
export { TransactionsPeriodSummary } from "./transactions-period-summary";
export type { TransactionsPeriodSummaryProps } from "./transactions-period-summary";
export { UncategorizedFilterChip } from "./uncategorized-filter-chip";
export type { UncategorizedFilterChipProps } from "./uncategorized-filter-chip";
