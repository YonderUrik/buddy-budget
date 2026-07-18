/**
 * components/domain/expenses — barrel file
 *
 * Punto di ingresso unico per i componenti della schermata Spese.
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
export { ExpensesKpiCards } from "./expenses-kpi-cards";
export type { ExpensesKpiCardsProps } from "./expenses-kpi-cards";
export { CategoryBreakdown } from "./category-breakdown";
export type { CategoryBreakdownProps } from "./category-breakdown";
export { ExpenseCharts } from "./expense-charts";
export type { ExpenseChartsProps } from "./expense-charts";
export { TransactionRow } from "./transaction-row";
export type { TransactionRowProps } from "./transaction-row";
export { SplitSlider } from "./split-slider";
export type { SplitSliderProps } from "./split-slider";
export { AddTransactionForm } from "./add-transaction-form";
export type { AddTransactionFormProps } from "./add-transaction-form";
