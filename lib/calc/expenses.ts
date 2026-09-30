import type { Transaction } from "@/lib/db/schema/transactions";
import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import { EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY, categoryGroupKey, type CategoryGroupKey } from "@/lib/categories/groups";

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

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
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

export function addMonths(date: Date, months: number): Date {
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

/** Transazione di entrata reale: importo positivo. */
export function isIncome(transaction: Transaction): boolean {
  return Number(transaction.amount) > 0;
}

/** Direzione per il filtro tipo-lista della schermata Transazioni. */
export type TransactionDirection = "tutte" | "uscita" | "entrata";

/** Filtra per direzione (entrata/uscita), o non filtra affatto ("tutte"). */
export function filterByTransactionType(
  transactions: Transaction[],
  direction: TransactionDirection
): Transaction[] {
  switch (direction) {
    case "tutte":
      return transactions;
    case "uscita":
      return transactions.filter(isExpense);
    case "entrata":
      return transactions.filter(isIncome);
  }
}

/** Importo effettivo dopo "Dividi" (stesso segno di `amount`): amount - excludedAmount. */
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

export interface IncomeSummary {
  entrate: number;
  escluse: number;
  entrateEffettive: number;
}

/** Somma Entrate / Escluse / Entrate effettive (valori positivi) per le transazioni di entrata nell'intervallo. */
export function computeIncomeSummary(transactions: Transaction[], range: DateRange): IncomeSummary {
  const inRange = transactions.filter((t) => isIncome(t) && isWithinRange(parseDateOnly(t.date), range));
  const entrate = inRange.reduce((sum, t) => sum + Number(t.amount), 0);
  const escluse = inRange.reduce((sum, t) => sum + Number(t.excludedAmount), 0);
  return { entrate, escluse, entrateEffettive: entrate - escluse };
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
  /** null quando l'utente non ha impostato alcun budget (nessuna categoria con un budget mensile). */
  budgetRimanente: number | null;
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
  // "Budget rimanente" ha senso solo confrontando budget e speso sulle STESSE categorie:
  // se il budget è impostato solo su alcune categorie, la spesa da confrontare è solo la loro.
  const budgetedCategoryIds = new Set(budgets.map((b) => b.categoryId));
  const budgetedTransactions = transactions.filter((t) => budgetedCategoryIds.has(t.categoryId));
  const { speseEffettive: budgetedSpeso } = computeSummary(budgetedTransactions, elapsedRange);
  const budgetRimanente = budgets.length === 0 ? null : budgetTotale - budgetedSpeso;
  const giorniRimasti = Math.max(0, daysBetween(todayStart, range.to));

  const elapsedDays = Math.max(1, daysBetween(range.from, elapsedRange.to) + 1);
  const mediaGiornaliera = speso / elapsedDays;

  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const { speseEffettive: prevSpeso } = computeSummary(transactions, previousRange);
  const previousDays = Math.max(1, daysBetween(previousRange.from, previousRange.to) + 1);
  const mediaGiornalieraPeriodoPrecedente = prevSpeso / previousDays;

  return { speso, budgetTotale, budgetRimanente, giorniRimasti, mediaGiornaliera, mediaGiornalieraPeriodoPrecedente };
}

export interface IncomeKpis {
  entrate: number;
  mediaGiornaliera: number;
  mediaGiornalieraPeriodoPrecedente: number;
}

/**
 * KPI entrate per il periodo selezionato: stessa finestra "giorni trascorsi" di `computeKpis`
 * (coerenza con le uscite). Nessun concetto di budget per le entrate.
 */
export function computeIncomeKpis(
  transactions: Transaction[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): IncomeKpis {
  const range = getPeriodRange(period, referenceDate);
  const todayStart = startOfDay(today);
  const clampedToday = todayStart.getTime() < range.from.getTime() ? range.from : todayStart;
  const elapsedRange: DateRange = {
    from: range.from,
    to: clampedToday.getTime() < range.to.getTime() ? clampedToday : range.to,
  };

  const { entrateEffettive: entrate } = computeIncomeSummary(transactions, elapsedRange);
  const elapsedDays = Math.max(1, daysBetween(range.from, elapsedRange.to) + 1);
  const mediaGiornaliera = entrate / elapsedDays;

  const previousRange = getPreviousPeriodRange(period, referenceDate);
  const { entrateEffettive: prevEntrate } = computeIncomeSummary(transactions, previousRange);
  const previousDays = Math.max(1, daysBetween(previousRange.from, previousRange.to) + 1);
  const mediaGiornalieraPeriodoPrecedente = prevEntrate / previousDays;

  return { entrate, mediaGiornaliera, mediaGiornalieraPeriodoPrecedente };
}

export interface CategoryAmount {
  categoryId: string;
  name: string;
  /** Gruppo di spesa della categoria; la fallback (e tipi non riconosciuti) → "daCategorizzare". */
  group: CategoryGroupKey;
  amount: number;
  color: string;
  icon: string;
}

/** Spesa effettiva per categoria nel periodo selezionato, una riga per ogni categoria di spesa dell'utente (entrate escluse). */
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

  return categories.flatMap((category) => {
    const group = categoryGroupKey(category);
    if (group === null) return [];
    const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
    const { speseEffettive } = computeSummary(categoryTransactions, elapsedRange);
    return [
      {
        categoryId: category.id,
        name: category.name,
        group,
        amount: speseEffettive,
        color: category.color,
        icon: category.icon,
      },
    ];
  });
}

export type GroupTotals = Record<CategoryGroupKey, number>;

/** Somma la spesa effettiva del periodo per gruppo di spesa (Dovute/Volute/Te futuro/Saltuarie) più "daCategorizzare". */
export function computeGroupTotals(
  transactions: Transaction[],
  categories: Category[],
  period: ExpensePeriod,
  referenceDate: Date,
  today: Date
): GroupTotals {
  const totals = Object.fromEntries(
    [...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY].map((key) => [key, 0])
  ) as GroupTotals;
  for (const entry of computeCategoryBreakdown(transactions, categories, period, referenceDate, today)) {
    totals[entry.group] += entry.amount;
  }
  return totals;
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

export interface MonthlyStackSegment {
  key: string;
  name: string;
  color: string;
  amount: number;
}

export interface MonthlyCategoryStack {
  year: number;
  month: number;
  label: string;
  segments: MonthlyStackSegment[];
}

export const OTHER_STACK_SEGMENT_KEY = "altro";

/**
 * Spesa effettiva per categoria sugli ultimi `monthCount` (default 6) mesi calendariali, con le top `topCount` categorie
 * e un eventuale segmento "Altro" ricalcolati indipendentemente per ciascun mese (non un ranking
 * fisso sul totale semestre): la stessa categoria può occupare posizioni diverse, o finire dentro
 * "Altro", da un mese all'altro. "Altro" è riordinato insieme alle categorie individuali per
 * importo, non è fisso in coda.
 */
export function computeCategoryMonthlyStacks(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date,
  topCount = 6,
  monthCount = 6
): MonthlyCategoryStack[] {
  const months: MonthlyCategoryStack[] = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const monthDate = addMonths(startOfMonth(referenceDate), -i);
    const range: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };

    const categoryAmounts = categories
      .map((category) => {
        const categoryTransactions = transactions.filter((t) => t.categoryId === category.id);
        const amount = computeSummary(categoryTransactions, range).speseEffettive;
        return { category, amount };
      })
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const topEntries = categoryAmounts.slice(0, topCount);
    const restEntries = categoryAmounts.slice(topCount);

    const segments: MonthlyStackSegment[] = topEntries.map((entry) => ({
      key: entry.category.id,
      name: entry.category.name,
      color: entry.category.color,
      amount: entry.amount,
    }));

    const otherAmount = restEntries.reduce((sum, entry) => sum + entry.amount, 0);
    if (otherAmount > 0) {
      segments.push({
        key: OTHER_STACK_SEGMENT_KEY,
        name: "Altro",
        color: OTHER_STACK_SEGMENT_KEY,
        amount: otherAmount,
      });
    }

    segments.sort((a, b) => b.amount - a.amount);

    months.push({
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: MONTH_LABELS[monthDate.getMonth()],
      segments,
    });
  }

  return months;
}

export interface TransactionFilter {
  categoryId: string | null;
  searchText: string;
  /** Se presente, tiene solo le transazioni di quel conto. */
  accountId?: string | null;
}

/** Filtra le transazioni per categoria esatta e/o substring case-insensitive su descrizione o nota, in AND. */
export function filterTransactions(
  transactions: Transaction[],
  filter: TransactionFilter
): Transaction[] {
  const normalizedSearch = filter.searchText.trim().toLocaleLowerCase();
  return transactions.filter((t) => {
    if (filter.categoryId !== null && t.categoryId !== filter.categoryId) return false;
    if (filter.accountId && t.accountId !== filter.accountId) return false;
    if (normalizedSearch === "") return true;
    const descriptionMatch = t.description.toLocaleLowerCase().includes(normalizedSearch);
    const noteMatch = (t.note ?? "").toLocaleLowerCase().includes(normalizedSearch);
    return descriptionMatch || noteMatch;
  });
}
