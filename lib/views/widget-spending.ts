/**
 * Spending widgets of the native apps (`GET /api/widgets/spending`, mobile spec `features/20-widgets.md`): today, this
 * week and this month spent, the gap from the usual month, what is left of the month's budget and the last movement.
 * Pure: it runs the same calculations as Panoramica (`computeMonthPace`, `paceGap`) and Liquidità · Budget
 * (`buildBudgetMonth`); the loader is `widget-spending.server.ts`.
 */
import { buildBudgetMonth, monthKey } from "@/lib/calc/budget-plan";
import { computeSummary, getPeriodRange, startOfDay } from "@/lib/calc/expenses";
import { computeMonthPace } from "@/lib/calc/month-pace";
import { toDateKey } from "@/lib/calc/net-worth";
import type { Budget, BudgetMonth } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";
import { paceGap } from "@/lib/overview/voice";
import type { WidgetSpending } from "./schemas";

/** The most recent expense or income (transfers excluded), with the merchant logo path Movimenti shows. */
export type WidgetMovementRow = Pick<Transaction, "id" | "date" | "amount" | "description"> & { logoPath: string | null };

export interface WidgetSpendingInputs {
  /** The device's day (local midnight). */
  today: Date;
  /** When the payload is built (`generatedAt`). */
  now: Date;
  currency: string;
  language: Language;
  hideAmounts: boolean;
  /**
   * Transactions from the start of the month-pace lookback (and, with budgets, of the longest carried leftover) to
   * the end of this month: the window Panoramica and Liquidità · Budget read.
   */
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  budgetMonths: BudgetMonth[];
  lastMovement: WidgetMovementRow | null;
}

/** Money values in the payload are rounded to the cent (the sums run in floating point). */
const round2 = (value: number) => Math.round(value * 100) / 100;
/** `budget.progress` keeps four decimals: enough for a ring, no float noise. */
const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

/** Builds the spending widgets' payload from loaded data. */
export function buildWidgetSpending(input: WidgetSpendingInputs): WidgetSpending {
  const today = startOfDay(input.today);
  const locale = LANGUAGE_LOCALES[input.language];
  const weekFrom = getPeriodRange("settimana", today).from;
  const spentIn = (from: Date) => round2(computeSummary(input.transactions, { from, to: today }).speseEffettive);

  const pace = computeMonthPace(input.transactions, input.budgets, today);
  const { gap, tone } = paceGap(pace.spentSoFar, pace.typicalSoFar);

  return {
    currency: input.currency,
    hideAmounts: input.hideAmounts,
    generatedAt: input.now.toISOString(),
    today: { date: toDateKey(today), spent: spentIn(today) },
    week: { from: toDateKey(weekFrom), spent: spentIn(weekFrom) },
    month: {
      key: monthKey(today),
      label: new Intl.DateTimeFormat(locale, { month: "long" }).format(today).toLocaleLowerCase(locale),
      spent: round2(pace.spentSoFar),
      typicalSoFar: pace.typicalSoFar === null ? null : round2(pace.typicalSoFar),
      gap: gap === null ? null : round2(gap),
      tone,
    },
    budget: widgetBudget(input, today),
    lastMovement: input.lastMovement ? widgetMovement(input.lastMovement) : null,
  };
}

/**
 * This month's budget as Liquidità · Budget computes it (carried leftover and one-month amounts included); null when
 * no category has a budget. `perDay` spreads what is left over the days to the month's end, today included.
 */
function widgetBudget(input: WidgetSpendingInputs, today: Date): WidgetSpending["budget"] {
  if (input.budgets.length === 0) return null;
  const plan = buildBudgetMonth({ transactions: input.transactions, categories: input.categories, budgets: input.budgets, months: input.budgetMonths, month: monthKey(today), today });
  if (plan.categories.length === 0) return null;
  const { available, spent, left } = plan.total;
  const daysLeft = plan.daysLeft ?? 1;
  return {
    available: round2(available),
    spent: round2(spent),
    left: round2(left),
    perDay: left > 0 ? round2(left / daysLeft) : null,
    // A budget of 0 with spending is full (1), not infinite: JSON has no Infinity.
    progress: available > 0 ? round4(spent / available) : spent > 0 ? 1 : 0,
  };
}

/** The last movement as the widget row shows it: signed amount, cleaned name (Movimenti's `description`), logo path. */
function widgetMovement(row: WidgetMovementRow): NonNullable<WidgetSpending["lastMovement"]> {
  const merchant = row.description.trim();
  return { id: row.id, date: row.date, amount: Number(row.amount), merchant: merchant === "" ? null : merchant, logoUrl: row.logoPath };
}
