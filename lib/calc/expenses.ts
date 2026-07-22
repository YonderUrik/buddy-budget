import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";

/** Periodo selezionabile nella schermata Spese. */
export type ExpensePeriod = "settimana" | "mese" | "3mesi" | "anno";

export interface DateRange {
  from: Date;
  to: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Costruisce una Date locale (mezzanotte) da una stringa "YYYY-MM-DD", senza slittamenti di fuso orario. */
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfISOWeek(date: Date): Date {
  const day = date.getDay(); // 0 = domenica
  const diffToMonday = day === 0 ? 6 : day - 1;
  return addDays(startOfDay(date), -diffToMonday);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** Intervallo calendariale del periodo selezionato, contenente referenceDate. */
export function getPeriodRange(period: ExpensePeriod, referenceDate: Date): DateRange {
  switch (period) {
    case "settimana": {
      const from = startOfISOWeek(referenceDate);
      return { from, to: addDays(from, 6) };
    }
    case "mese":
      return { from: startOfMonth(referenceDate), to: endOfMonth(referenceDate) };
    case "3mesi":
      return { from: startOfMonth(addMonths(referenceDate, -2)), to: endOfMonth(referenceDate) };
    case "anno":
      return { from: new Date(referenceDate.getFullYear(), 0, 1), to: new Date(referenceDate.getFullYear(), 11, 31) };
  }
}

/** Intervallo, di uguale lunghezza calendariale, immediatamente precedente al periodo selezionato. */
export function getPreviousPeriodRange(period: ExpensePeriod, referenceDate: Date): DateRange {
  let shiftedReference: Date;
  switch (period) {
    case "settimana":
      shiftedReference = addDays(referenceDate, -7);
      break;
    case "mese":
      shiftedReference = addMonths(referenceDate, -1);
      break;
    case "3mesi":
      shiftedReference = addMonths(referenceDate, -3);
      break;
    case "anno":
      shiftedReference = new Date(referenceDate.getFullYear() - 1, referenceDate.getMonth(), referenceDate.getDate());
      break;
  }
  return getPeriodRange(period, shiftedReference);
}

/** Sposta referenceDate di un'unità di periodo (avanti se direction=1, indietro se direction=-1). */
export function shiftReferenceDate(period: ExpensePeriod, referenceDate: Date, direction: 1 | -1): Date {
  switch (period) {
    case "settimana":
      return addDays(referenceDate, 7 * direction);
    case "mese":
      return addMonths(referenceDate, 1 * direction);
    case "3mesi":
      return addMonths(referenceDate, 3 * direction);
    case "anno":
      return new Date(referenceDate.getFullYear() + direction, referenceDate.getMonth(), referenceDate.getDate());
  }
}

function isWithinRange(date: Date, range: DateRange): boolean {
  const day = startOfDay(date);
  return day.getTime() >= range.from.getTime() && day.getTime() <= range.to.getTime();
}

/** Transazione di spesa reale (uscita bancaria): importo negativo. Le entrate non fanno parte di Spese. */
export function isExpense(transaction: Transaction): boolean {
  return Number(transaction.amount) < 0;
}

/** Importo (negativo) della spesa effettiva dopo "Dividi": amount - excludedAmount. */
export function effectiveAmount(transaction: Transaction): number {
  return Number(transaction.amount) - Number(transaction.excludedAmount);
}

export interface ExpensesSummary {
  uscite: number;
  escluse: number;
  speseEffettive: number;
}

/** Somma Uscite / Escluse / Spese effettive (valori positivi) per le transazioni di spesa nell'intervallo. */
export function computeSummary(transactions: Transaction[], range: DateRange): ExpensesSummary {
  const inRange = transactions.filter((t) => isExpense(t) && isWithinRange(parseDateOnly(t.date), range));
  const uscite = inRange.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const escluse = inRange.reduce((sum, t) => sum + Math.abs(Number(t.excludedAmount)), 0);
  return { uscite, escluse, speseEffettive: uscite - escluse };
}

function totalMonthlyBudget(budgets: Budget[]): number {
  return budgets.reduce((sum, b) => sum + Number(b.monthlyAmount), 0);
}

/** Scala un budget mensile totale sulla lunghezza del periodo selezionato. */
export function scaleBudgetForPeriod(monthlyTotal: number, period: ExpensePeriod): number {
  switch (period) {
    case "settimana":
      return (monthlyTotal / 30) * 7;
    case "mese":
      return monthlyTotal;
    case "3mesi":
      return monthlyTotal * 3;
    case "anno":
      return monthlyTotal * 12;
  }
}

export interface ExpensesKpis {
  speso: number;
  budgetTotale: number;
  budgetRimanente: number;
  giorniRimasti: number;
  mediaGiornaliera: number;
  mediaGiornalieraPeriodoPrecedente: number;
}

/**
 * KPI principali di Spese per il periodo selezionato. "Speso" e "Media giornaliera" contano solo i
 * giorni del periodo già trascorsi (fino a referenceDate incluso); "Budget rimanente"/"giorni rimasti"
 * guardano invece all'intero periodo calendariale (anche i giorni futuri).
 */
export function computeKpis(
  transactions: Transaction[],
  budgets: Budget[],
  period: ExpensePeriod,
  referenceDate: Date
): ExpensesKpis {
  const range = getPeriodRange(period, referenceDate);
  const today = startOfDay(referenceDate);
  const elapsedRange: DateRange = { from: range.from, to: today.getTime() < range.to.getTime() ? today : range.to };

  const { speseEffettive: speso } = computeSummary(transactions, elapsedRange);

  const budgetTotale = scaleBudgetForPeriod(totalMonthlyBudget(budgets), period);
  const budgetRimanente = budgetTotale - speso;
  const giorniRimasti = Math.max(0, daysBetween(today, range.to));

  const elapsedDays = Math.max(1, daysBetween(range.from, elapsedRange.to) + 1);
  const mediaGiornaliera = speso / elapsedDays;

  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const { speseEffettive: prevSpeso } = computeSummary(transactions, previousRange);
  const previousDays = Math.max(1, daysBetween(previousRange.from, previousRange.to) + 1);
  const mediaGiornalieraPeriodoPrecedente = prevSpeso / previousDays;

  return { speso, budgetTotale, budgetRimanente, giorniRimasti, mediaGiornaliera, mediaGiornalieraPeriodoPrecedente };
}

export interface CategoryAmount {
  categoryId: string;
  name: string;
  type: "fissa" | "variabile";
  amount: number;
  color: string;
  icon: string;
}

/** Spesa effettiva per categoria nel periodo selezionato, una riga per ogni categoria dell'utente. */
export function computeCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date
): CategoryAmount[] {
  const range = getPeriodRange(period, referenceDate);
  const today = startOfDay(referenceDate);
  const elapsedRange: DateRange = { from: range.from, to: today.getTime() < range.to.getTime() ? today : range.to };

  return categories.map((category) => {
    const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
    const { speseEffettive } = computeSummary(categoryTransactions, elapsedRange);
    return {
      categoryId: category.id,
      name: category.name,
      type: category.type,
      amount: speseEffettive,
      color: category.color,
      icon: category.icon,
    };
  });
}

export interface FixedVsVariable {
  fissa: number;
  variabile: number;
}

/** Somma spesa effettiva del periodo, raggruppata per tipo categoria (fissa/variabile). */
export function computeFixedVsVariable(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date
): FixedVsVariable {
  const breakdown = computeCategoryBreakdown(transactions, categories, period, referenceDate);
  return breakdown.reduce(
    (totals, entry) => {
      totals[entry.type] += entry.amount;
      return totals;
    },
    { fissa: 0, variabile: 0 }
  );
}

export interface MonthlyTotal {
  year: number;
  month: number;
  label: string;
  total: number;
}

export const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

/** Spesa effettiva totale per ciascuno degli ultimi 6 mesi calendariali (incluso quello corrente), indipendente dal periodo selezionato. */
export function compute6MonthTrend(transactions: Transaction[], referenceDate: Date): MonthlyTotal[] {
  const months: MonthlyTotal[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = addMonths(referenceDate, -i);
    const range: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };
    const { speseEffettive } = computeSummary(transactions, range);
    months.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      total: speseEffettive,
    });
  }
  return months;
}
