import type { Transaction } from "@/lib/db/schema/transactions";
import type { Category } from "@/lib/db/schema/categories";
import {
  addMonths,
  effectiveAmount,
  endOfMonth,
  isExpense,
  isIncome,
  MONTH_LABELS,
  parseDateOnly,
  startOfDay,
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

/**
 * Somma `months` (positivi o negativi) a `date` in aritmetica pura di indice mese
 * (anno*12+mese), clampando il giorno al massimo valido nel mese di destinazione
 * invece di lasciarlo traboccare nel mese successivo come farebbe `new Date(y, m+n, d)`
 * nativo quando `d` non esiste nel mese target (es. 31 maggio - 3 mesi = 28 febbraio,
 * non 3 marzo). Necessario ovunque il "mese di destinazione" debba essere corretto
 * indipendentemente dal giorno di partenza (29-31).
 */
function addWholeMonths(date: Date, months: number): Date {
  const totalMonths = date.getFullYear() * 12 + date.getMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths - year * 12;
  const daysInTargetMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(date.getDate(), daysInTargetMonth);
  return new Date(year, month, day);
}

/** Intervallo calendariale del periodo Cash flow: `months` mesi calendariali fino a `referenceDate` incluso. */
export function getCashflowPeriodRange(period: CashflowPeriod, referenceDate: Date): DateRange {
  const months = PERIOD_MONTHS[period];
  return { from: startOfMonth(addWholeMonths(referenceDate, -(months - 1))), to: endOfMonth(referenceDate) };
}

/** Intervallo, di uguale lunghezza, immediatamente precedente al periodo Cash flow selezionato. */
export function getPreviousCashflowPeriodRange(period: CashflowPeriod, referenceDate: Date): DateRange {
  const months = PERIOD_MONTHS[period];
  return getCashflowPeriodRange(period, addWholeMonths(referenceDate, -months));
}

/**
 * Sposta referenceDate di un'unità di periodo Cash flow (avanti se direction=1, indietro se
 * direction=-1). Il giorno del mese è preservato quando esiste nel mese di destinazione,
 * altrimenti clampato (es. dal 31 gennaio indietro di un mese si ottiene il 28/29 febbraio,
 * mai un mese saltato o duplicato) — shiftare avanti e indietro riporta sempre allo stesso
 * mese, anche se non necessariamente allo stesso giorno esatto in presenza di clamp.
 */
export function shiftCashflowReferenceDate(period: CashflowPeriod, referenceDate: Date, direction: 1 | -1): Date {
  const months = PERIOD_MONTHS[period];
  return addWholeMonths(referenceDate, months * direction);
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

/**
 * KPI principali di Cash flow per il periodo selezionato. Attenzione alle unità:
 * `entrateMedie`/`usciteMedie` sono medie mensili, `flussoNettoTotale` è invece il
 * totale sull'intero periodo (non sottrarre le medie per ottenerlo — non coincidono
 * se il periodo include un mese in corso solo parzialmente trascorso), `tassoRisparmio`
 * è un rapporto 0–1 (non una percentuale, a differenza dei `quotaPct` altrove nel modulo).
 */
export interface CashflowKpis {
  /** Entrate medie mensili nel periodo (totale entrate ÷ mesi trascorsi, il mese in corso conta pro-quota). */
  entrateMedie: number;
  /** Uscite medie mensili nel periodo (totale uscite effettive ÷ mesi trascorsi, il mese in corso conta pro-quota). */
  usciteMedie: number;
  /** Flusso netto totale sull'intero periodo selezionato (entrate - uscite), non una media. */
  flussoNettoTotale: number;
  /** Rapporto 0–1 (non percentuale) tra flusso netto totale ed entrate totali del periodo. null se le entrate nel periodo sono zero (non calcolabile). */
  tassoRisparmio: number | null;
}

/**
 * Frazione di `monthDate` già trascorsa rispetto a `today`: 1 se il mese è interamente nel
 * passato, 0 se è ancora nel futuro, altrimenti giorno-del-mese-di-today ÷ giorni-nel-mese
 * per il mese in corso (proporzionale, non contato come mese intero).
 */
function elapsedMonthFraction(monthDate: Date, today: Date): number {
  const monthRange: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };
  const todayStart = startOfDay(today);
  if (todayStart.getTime() >= monthRange.to.getTime()) return 1;
  if (todayStart.getTime() < monthRange.from.getTime()) return 0;
  const daysInMonth = monthRange.to.getDate();
  return todayStart.getDate() / daysInMonth;
}

/** Numero di mesi trascorsi (frazionario) nel range rispetto a `today`, per non contare un mese in corso come intero. */
function elapsedMonthCount(range: DateRange, today: Date): number {
  return monthsInRange(range).reduce((sum, monthDate) => sum + elapsedMonthFraction(monthDate, today), 0);
}

/**
 * KPI principali di Cash flow: entrate/uscite medie mensili, flusso netto totale, tasso di
 * risparmio sul periodo selezionato. `today` è la data reale corrente (indipendente da quale
 * periodo si sta guardando, stesso pattern di `computeKpis` in `expenses.ts`): serve a non
 * contare un mese in corso solo parzialmente trascorso come un mese intero nel denominatore
 * delle medie. Entrate e uscite contano solo l'importo effettivo post-"Dividi" (`effectiveAmount`),
 * coerentemente con Spese.
 */
export function computeCashflowKpis(transactions: Transaction[], range: DateRange, today: Date): CashflowKpis {
  const inRange = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), range));
  const entrate = inRange.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0);
  const uscite = inRange.filter(isExpense).reduce((sum, t) => sum + Math.abs(effectiveAmount(t)), 0);

  const elapsedMonths = elapsedMonthCount(range, today);
  const monthCount = elapsedMonths > 0 ? elapsedMonths : monthsInRange(range).length;

  const flussoNettoTotale = entrate - uscite;
  return {
    entrateMedie: entrate / monthCount,
    usciteMedie: uscite / monthCount,
    flussoNettoTotale,
    tassoRisparmio: entrate > 0 ? flussoNettoTotale / entrate : null,
  };
}

/** Entrate/uscite di un singolo mese calendariale, riga della serie mensile Cash flow. */
export interface CashflowMonthlyEntry {
  year: number;
  month: number;
  label: string;
  entrate: number;
  uscite: number;
}

/** Etichetta mese per gli assi Cash flow: aggiunge l'anno abbreviato se il range copre più anni solari, per non confondere mesi omonimi (es. lug 2024 e lug 2025 su un periodo 24 mesi). */
function formatMonthAxisLabel(monthDate: Date, range: DateRange): string {
  const monthLabel = MONTH_LABELS[monthDate.getMonth()];
  const spansMultipleYears = range.from.getFullYear() !== range.to.getFullYear();
  return spansMultipleYears ? `${monthLabel} '${String(monthDate.getFullYear()).slice(-2)}` : monthLabel;
}

/** Serie mensile entrate/uscite per ciascun mese calendariale nel range (inclusi i mesi senza transazioni, a 0). Entrate e uscite contano l'importo effettivo post-"Dividi" (`effectiveAmount`). */
export function computeMonthlySeries(transactions: Transaction[], range: DateRange): CashflowMonthlyEntry[] {
  return monthsInRange(range).map((monthDate) => {
    const monthRange: DateRange = { from: startOfMonth(monthDate), to: endOfMonth(monthDate) };
    const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
    return {
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      label: formatMonthAxisLabel(monthDate, range),
      entrate: inMonth.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0),
      uscite: inMonth.filter(isExpense).reduce((sum, t) => sum + Math.abs(effectiveAmount(t)), 0),
    };
  });
}

/** Entrata per singola categoria nel periodo, riga di `computeIncomeSources`. */
export interface IncomeSourceAmount {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  /** null se il totale entrate nel periodo è zero (non calcolabile). */
  quotaPct: number | null;
}

/**
 * Entrate per categoria nel periodo, ordinate decrescenti, con quota % sul totale entrate.
 * Esclude le categorie a importo zero. Raggruppa per `categoryId` effettivo delle transazioni
 * (non solo le categorie di tipo "entrata"): un'entrata ancora sulla categoria fallback "Da
 * categorizzare" (type "variabile") o su una categoria mal classificata compare comunque come
 * riga propria, con il nome/colore/icona reali della categoria — altrimenti il totale usato
 * come denominatore includerebbe entrate mai mostrate come riga, e le quote % non
 * sommerebbero a 100%.
 */
export function computeIncomeSources(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange
): IncomeSourceAmount[] {
  const inRange = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), range) && isIncome(t));
  const totalEntrate = inRange.reduce((sum, t) => sum + effectiveAmount(t), 0);
  const categoryById = new Map(categories.map((c) => [c.id, c] as const));

  const amountByCategoryId = new Map<string, number>();
  for (const t of inRange) {
    amountByCategoryId.set(t.categoryId, (amountByCategoryId.get(t.categoryId) ?? 0) + effectiveAmount(t));
  }

  return Array.from(amountByCategoryId.entries())
    .map(([categoryId, amount]) => {
      const category = categoryById.get(categoryId);
      return {
        categoryId,
        name: category?.name ?? "Non categorizzato",
        color: category?.color ?? "slate",
        icon: category?.icon ?? "help-circle",
        amount,
        quotaPct: totalEntrate > 0 ? (amount / totalEntrate) * 100 : null,
      };
    })
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/** Riga di `computeWhereItGoes`: una delle quattro voci fisse/variabili/non classificato/risparmio del mese. */
export interface WhereItGoesEntry {
  key: "fisse" | "variabili" | "nonClassificato" | "risparmio";
  label: string;
  amount: number;
  /** null se le entrate del mese sono zero (non calcolabile). Il risparmio può essere negativo (nessun floor a zero). */
  quotaPct: number | null;
}

/**
 * "Dove va ogni euro" del mese di riferimento: spese fisse, spese variabili, spese su
 * categorie non classificabili come fisse/variabili (categoria assente dall'array passato,
 * o erroneamente di tipo "entrata"), e risparmio (entrate - fisse - variabili - non
 * classificato), con quota % sul totale entrate. Le spese non classificabili hanno una
 * riga dedicata proprio per non essere assorbite silenziosamente nel risparmio. Entrate e
 * uscite contano solo l'importo effettivo post-"Dividi" (`effectiveAmount`), coerentemente
 * con Spese.
 */
export function computeWhereItGoes(
  transactions: Transaction[],
  categories: Category[],
  referenceDate: Date
): WhereItGoesEntry[] {
  const monthRange: DateRange = { from: startOfMonth(referenceDate), to: endOfMonth(referenceDate) };
  const inMonth = transactions.filter((t) => isWithinRange(parseDateOnly(t.date), monthRange));
  const categoryTypeById = new Map(categories.map((c) => [c.id, c.type] as const));

  const entrate = inMonth.filter(isIncome).reduce((sum, t) => sum + effectiveAmount(t), 0);
  const expenseTransactions = inMonth.filter(isExpense);

  const fisse = expenseTransactions
    .filter((t) => categoryTypeById.get(t.categoryId) === "fissa")
    .reduce((sum, t) => sum + Math.abs(effectiveAmount(t)), 0);
  const variabili = expenseTransactions
    .filter((t) => categoryTypeById.get(t.categoryId) === "variabile")
    .reduce((sum, t) => sum + Math.abs(effectiveAmount(t)), 0);
  const nonClassificato = expenseTransactions
    .filter((t) => {
      const type = categoryTypeById.get(t.categoryId);
      return type !== "fissa" && type !== "variabile";
    })
    .reduce((sum, t) => sum + Math.abs(effectiveAmount(t)), 0);
  const risparmio = entrate - fisse - variabili - nonClassificato;

  const quotaOf = (amount: number) => (entrate > 0 ? (amount / entrate) * 100 : null);
  return [
    { key: "fisse", label: "Spese fisse", amount: fisse, quotaPct: quotaOf(fisse) },
    { key: "variabili", label: "Spese variabili", amount: variabili, quotaPct: quotaOf(variabili) },
    { key: "nonClassificato", label: "Non classificato", amount: nonClassificato, quotaPct: quotaOf(nonClassificato) },
    { key: "risparmio", label: "Risparmio", amount: risparmio, quotaPct: quotaOf(risparmio) },
  ];
}

/** Riga di `computeAccumulatedSavings`: somma cumulata del flusso netto fino a quel mese incluso. */
export interface AccumulatedSavingsEntry {
  year: number;
  month: number;
  label: string;
  cumulative: number;
}

/** Somma cumulata mese su mese del flusso netto (entrate - uscite effettive) lungo il range selezionato. */
export function computeAccumulatedSavings(transactions: Transaction[], range: DateRange): AccumulatedSavingsEntry[] {
  const monthly = computeMonthlySeries(transactions, range);
  let running = 0;
  return monthly.map((entry) => {
    running += entry.entrate - entry.uscite;
    return { year: entry.year, month: entry.month, label: entry.label, cumulative: running };
  });
}
