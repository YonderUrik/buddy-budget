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

/** Annulla la componente oraria di una Date, mantenendo solo l'anno/mese/giorno locale (mezzanotte). */
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Etichetta leggibile del periodo mostrato in Spese, formattata secondo il tipo (mese/settimana/3mesi/anno). */
export function formatPeriodLabel(period: ExpensePeriod, range: DateRange): string {
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  switch (period) {
    case "mese": {
      const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(range.from);
      return `${capitalize(monthName)} ${range.from.getFullYear()}`;
    }
    case "anno":
      return `${range.from.getFullYear()}`;
    case "settimana": {
      const sameMonth = sameYear && range.from.getMonth() === range.to.getMonth();
      if (sameMonth) {
        const day = new Intl.DateTimeFormat("it-IT", { day: "numeric" }).format(range.from);
        const dayMonth = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(range.to);
        return `${day}–${dayMonth}`;
      }
      if (sameYear) {
        const dayMonthFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
        return `${dayMonthFormat.format(range.from)} – ${dayMonthFormat.format(range.to)}`;
      }
      const fullFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });
      return `${fullFormat.format(range.from)} – ${fullFormat.format(range.to)}`;
    }
    case "3mesi": {
      const monthYearFormat = new Intl.DateTimeFormat("it-IT", { month: "short", year: "numeric" });
      if (sameYear) {
        const monthOnly = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(range.from);
        return `${capitalize(monthOnly)} – ${capitalize(monthYearFormat.format(range.to))}`;
      }
      return `${capitalize(monthYearFormat.format(range.from))} – ${capitalize(monthYearFormat.format(range.to))}`;
    }
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
 * giorni del periodo già trascorsi rispetto a `today` (la data reale corrente); "Budget rimanente"/
 * "giorni rimasti" guardano invece all'intero periodo calendariale (anche i giorni futuri).
 * `referenceDate` è il periodo che si sta guardando (può essere passato o presente, mai futuro);
 * `today` è sempre la data reale, indipendente da quale periodo si sta navigando.
 */
export function computeKpis(
  transactions: Transaction[],
  budgets: Budget[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): ExpensesKpis {
  const range = getPeriodRange(period, referenceDate);
  const todayStart = startOfDay(today);
  const clampedToday = todayStart.getTime() < range.from.getTime() ? range.from : todayStart;
  const elapsedRange: DateRange = {
    from: range.from,
    to: clampedToday.getTime() < range.to.getTime() ? clampedToday : range.to,
  };

  const { speseEffettive: speso } = computeSummary(transactions, elapsedRange);

  const budgetTotale = scaleBudgetForPeriod(totalMonthlyBudget(budgets), period);
  const budgetRimanente = budgetTotale - speso;
  const giorniRimasti = Math.max(0, daysBetween(todayStart, range.to));

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
  referenceDate: Date,
  today: Date
): CategoryAmount[] {
  const range = getPeriodRange(period, referenceDate);
  const todayStart = startOfDay(today);
  const clampedToday = todayStart.getTime() < range.from.getTime() ? range.from : todayStart;
  const elapsedRange: DateRange = {
    from: range.from,
    to: clampedToday.getTime() < range.to.getTime() ? clampedToday : range.to,
  };

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
  referenceDate: Date,
  today: Date
): FixedVsVariable {
  const breakdown = computeCategoryBreakdown(transactions, categories, period, referenceDate, today);
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

/** Etichette abbreviate mensili in italiano, usate nel grafico di andamento su 6 mesi. */
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

export interface MonthlyCategoryTotal {
  year: number;
  month: number;
  label: string;
  amounts: Record<string, number>;
}

export interface CategoryTrendSeries {
  key: string;
  name: string;
  color: string;
}

export interface CategoryMonthlyTrend {
  months: MonthlyCategoryTotal[];
  series: CategoryTrendSeries[];
}

const OTHER_TREND_SERIES_KEY = "altro";

/**
 * Spesa effettiva per categoria sugli ultimi 6 mesi calendariali, con le top `topCount` categorie
 * (per spesa totale sul semestre) come serie proprie e il resto aggregato in una serie "Altro".
 * Il ranking è calcolato una sola volta sull'intero semestre, così che ogni categoria mantenga
 * sempre lo stesso segmento/colore da un mese all'altro.
 */
export function computeCategoryMonthlyTrend(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6
): CategoryMonthlyTrend {
  const monthRanges: { year: number; month: number; label: string; range: DateRange }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = addMonths(referenceDate, -i);
    monthRanges.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      range: { from: startOfMonth(monthDate), to: endOfMonth(monthDate) },
    });
  }

  const perMonthByCategory = new Map<string, number[]>();
  const totalByCategory = new Map<string, number>();

  categories.forEach((category) => {
    const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
    const perMonth = monthRanges.map((m) => computeSummary(categoryTransactions, m.range).speseEffettive);
    perMonthByCategory.set(category.id, perMonth);
    totalByCategory.set(category.id, perMonth.reduce((sum, v) => sum + v, 0));
  });

  const rankedCategories = [...categories].sort(
    (a, b) => (totalByCategory.get(b.id) ?? 0) - (totalByCategory.get(a.id) ?? 0)
  );
  const topCategories = rankedCategories.slice(0, topCount);
  const restCategories = rankedCategories.slice(topCount);
  const hasOther = restCategories.some((category) => (totalByCategory.get(category.id) ?? 0) > 0);

  const series: CategoryTrendSeries[] = topCategories.map((category) => ({
    key: category.id,
    name: category.name,
    color: category.color,
  }));
  if (hasOther) {
    series.push({ key: OTHER_TREND_SERIES_KEY, name: "Altro", color: OTHER_TREND_SERIES_KEY });
  }

  const months: MonthlyCategoryTotal[] = monthRanges.map((m, index) => {
    const amounts: Record<string, number> = {};
    topCategories.forEach((category) => {
      amounts[category.id] = perMonthByCategory.get(category.id)?.[index] ?? 0;
    });
    if (hasOther) {
      amounts[OTHER_TREND_SERIES_KEY] = restCategories.reduce(
        (sum, category) => sum + (perMonthByCategory.get(category.id)?.[index] ?? 0),
        0
      );
    }
    return { year: m.year, month: m.month, label: m.label, amounts };
  });

  return { months, series };
}

export interface TransactionFilter {
  categoryId: string | null;
  searchText: string;
}

/** Filtra le transazioni per categoria esatta e/o substring case-insensitive sulla descrizione, in AND. */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[] {
  const normalizedSearch = filter.searchText.trim().toLocaleLowerCase();
  return transactions.filter((t) => {
    if (filter.categoryId !== null && t.categoryId !== filter.categoryId) return false;
    if (normalizedSearch !== "" && !t.description.toLocaleLowerCase().includes(normalizedSearch)) return false;
    return true;
  });
}
