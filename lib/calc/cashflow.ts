import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";
import {
  addMonths,
  endOfMonth,
  isExpense,
  isIncome,
  MONTH_LABELS,
  parseDateOnly,
  startOfMonth,
  type DateRange,
} from "./expenses";

/** Periodo selezionabile nella schermata Cash flow. */
export type CashflowPeriod = "3mesi" | "6mesi" | "12mesi" | "24mesi";

const PERIOD_MONTHS: Record<CashflowPeriod, number> = {
  "3mesi": 3,
  "6mesi": 6,
  "12mesi": 12,
  "24mesi": 24,
};

function isWithinRange(date: Date, range: DateRange): boolean {
  return date.getTime() >= range.from.getTime() && date.getTime() <= range.to.getTime();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function monthsInRange(range: DateRange): Date[] {
  const months: Date[] = [];
  let cursor = startOfMonth(range.from);
  const end = startOfMonth(range.to);
  while (cursor.getTime() <= end.getTime()) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

/** Intervallo calendariale del periodo Cash flow: `months` mesi calendariali fino a `referenceDate` incluso. */
export function getCashflowPeriodRange(period: CashflowPeriod, referenceDate: Date): DateRange {
  const months = PERIOD_MONTHS[period];
  return { from: startOfMonth(addMonths(referenceDate, -(months - 1))), to: endOfMonth(referenceDate) };
}

/** Intervallo, di uguale lunghezza, immediatamente precedente al periodo Cash flow selezionato. */
export function getPreviousCashflowPeriodRange(period: CashflowPeriod, referenceDate: Date): DateRange {
  const months = PERIOD_MONTHS[period];
  return getCashflowPeriodRange(period, addMonths(referenceDate, -months));
}

/** Sposta referenceDate di un'unità di periodo Cash flow (avanti se direction=1, indietro se direction=-1). */
export function shiftCashflowReferenceDate(period: CashflowPeriod, referenceDate: Date, direction: 1 | -1): Date {
  const months = PERIOD_MONTHS[period];
  return addMonths(referenceDate, months * direction);
}

/** Etichetta leggibile del periodo Cash flow, es. "Gen – Mar 2026" o "Gen 2025 – Dic 2026". */
export function formatCashflowPeriodLabel(range: DateRange): string {
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  const monthYearFormat = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });
  if (sameYear) {
    const monthOnly = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(range.from);
    return `${capitalize(monthOnly)} – ${capitalize(monthYearFormat.format(range.to))}`;
  }
  return `${capitalize(monthYearFormat.format(range.from))} – ${capitalize(monthYearFormat.format(range.to))}`;
}

export interface CashflowKpis {
  entrateMedie: number;
  usciteMedie: number;
  flussoNetto: number;
  /** null se le entrate nel periodo sono zero (non calcolabile). */
  tassoRisparmio: number | null;
}

/** KPI principali di Cash flow: entrate/uscite medie mensili, flusso netto, tasso di risparmio sul periodo selezionato. */
export function computeCashflowKpis(transactions: Transaction[], range: DateRange): CashflowKpis {
  const inRange = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), range));
  const entrate = inRange.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
  const uscite = inRange.filter(isExpense).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const monthCount = monthsInRange(range).length;

  const flussoNetto = entrate - uscite;
  return {
    entrateMedie: entrate / monthCount,
    usciteMedie: uscite / monthCount,
    flussoNetto,
    tassoRisparmio: entrate > 0 ? flussoNetto / entrate : null,
  };
}

export interface CashflowMonthlyEntry {
  year: number;
  month: number;
  label: string;
  entrate: number;
  uscite: number;
}

/** Serie mensile entrate/uscite per ciascun mese calendariale nel range (inclusi i mesi senza transazioni, a 0). */
export function computeMonthlySeries(transactions: Transaction[], range: DateRange): CashflowMonthlyEntry[] {
  return monthsInRange(range).map((monthDate) => {
    const monthRange: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };
    const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
    return {
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      entrate: inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0),
      uscite: inMonth.filter(isExpense).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0),
    };
  });
}

export interface IncomeSourceAmount {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  /** null se il totale entrate nel periodo è zero (non calcolabile). */
  quotaPct: number | null;
}

/** Entrate per categoria di tipo "entrata" nel periodo, ordinate decrescenti, con quota % sul totale entrate. Esclude le fonti a importo zero. */
export function computeIncomeSources(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange
): IncomeSourceAmount[] {
  const incomeCategories = categories.filter((c) => c.type === "entrata");
  const inRange = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), range) && isIncome(t));
  const totalEntrate = inRange.reduce((sum, t) => sum + Number(t.amount), 0);

  return incomeCategories
    .map((category) => {
      const amount = inRange
        .filter((t) => t.categoryId === category.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        amount,
        quotaPct: totalEntrate > 0 ? (amount / totalEntrate) * 100 : null,
      };
    })
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export interface WhereItGoesEntry {
  key: "fisse" | "variabili" | "risparmio";
  label: string;
  amount: number;
  /** null se le entrate del mese sono zero (non calcolabile). Il risparmio può essere negativo (nessun floor a zero). */
  quotaPct: number | null;
}

/** "Dove va ogni euro" del mese di riferimento: spese fisse, spese variabili, risparmio (entrate - fisse - variabili), con quota % sul totale entrate. */
export function computeWhereItGoes(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date
): WhereItGoesEntry[] {
  const monthRange: DateRange = { from: startOfMonth(referenceDate), to: endOfMonth(referenceDate) };
  const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
  const categoryTypeById = new Map(categories.map((c) => [c.id, c.type] as const));

  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + Number(t.amount), 0);
  const fisse = inMonth
    .filter((t) => isExpense(t) && categoryTypeById.get(t.categoryId) === "fissa")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const variabili = inMonth
    .filter((t) => isExpense(t) && categoryTypeById.get(t.categoryId) === "variabile")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  const risparmio = entrate - fisse - variabili;

  const quotaOf = (amount: number) => (entrate > 0 ? (amount / entrate) * 100 : null);
  return [
    { key: "fisse", label: "Spese fisse", amount: fisse, quotaPct: quotaOf(fisse) },
    { key: "variabili", label: "Spese variabili", amount: variabili, quotaPct: quotaOf(variabili) },
    { key: "risparmio", label: "Risparmio", amount: risparmio, quotaPct: quotaOf(risparmio) },
  ];
}

export interface AccumulatedSavingsEntry {
  year: number;
  month: number;
  label: string;
  cumulative: number;
}

/** Somma cumulata mese su mese del flusso netto (entrate - uscite) lungo il range selezionato. */
export function computeAccumulatedSavings(transactions: Transaction[], range: DateRange): AccumulatedSavingsEntry[] {
  const monthly = computeMonthlySeries(transactions, range);
  let running = 0;
  return monthly.map((entry) => {
    running += entry.entrate - entry.uscite;
    return { year: entry.year, month: entry.month, label: entry.label, cumulative: running };
  });
}
