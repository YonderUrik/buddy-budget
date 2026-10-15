import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import {
  computeCategoryBreakdown,
  computeIncomeSummary,
  computeSummary,
  formatPeriodLabel,
  getPeriodRange,
  getPreviousPeriodRange,
  scaleBudgetForPeriod,
  shiftReferenceDate,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
import { DIGEST_MONTHLY_MAX_DAY, DIGEST_WEEKLY_WEEKDAYS, type DigestFrequency } from "./constants";
import { romeDate, romeReferenceDate } from "./dates";
import type { InvestmentDigest } from "./investments-digest";
import type { GoalsDigest } from "./goals";

const TOP_CATEGORIES = 3;
const PERIOD_BY_FREQUENCY: Record<DigestFrequency, ExpensePeriod> = { settimanale: "settimana", mensile: "mese" };

/** True se oggi è un giorno in cui parte il riepilogo di quella frequenza (la deduplica evita i doppioni nei giorni di margine). */
export function isDigestDay(frequency: DigestFrequency, now: Date): boolean {
  const { day, weekday } = romeDate(now);
  return frequency === "mensile" ? day <= DIGEST_MONTHLY_MAX_DAY : (DIGEST_WEEKLY_WEEKDAYS as readonly number[]).includes(weekday);
}

export interface DigestPeriod {
  period: ExpensePeriod;
  /** Chiave per la deduplica: `2026-09` o `2026-W41` (settimana che inizia il lunedì indicato). */
  key: string;
  label: string;
  referenceDate: Date;
}

/** Ultimo periodo concluso (mese o settimana precedente a oggi). */
export function digestPeriod(frequency: DigestFrequency, now: Date): DigestPeriod {
  const period = PERIOD_BY_FREQUENCY[frequency];
  const referenceDate = shiftReferenceDate(period, romeReferenceDate(now), -1);
  const range = getPeriodRange(period, referenceDate);
  const pad = (n: number) => String(n).padStart(2, "0");
  const key =
    frequency === "mensile"
      ? `${range.from.getFullYear()}-${pad(range.from.getMonth() + 1)}`
      : `${range.from.getFullYear()}-${pad(range.from.getMonth() + 1)}-${pad(range.from.getDate())}`;
  return { period, key: `digest:${frequency}:${key}`, label: formatPeriodLabel(period, range), referenceDate };
}

/** Primo giorno (ISO) da cui servono i movimenti: l'inizio del periodo precedente a quello del riepilogo, per il confronto. */
export function digestWindowStartIso(frequency: DigestFrequency, now: Date): string {
  const period = digestPeriod(frequency, now);
  return toIso(getPreviousPeriodRange(period.period, period.referenceDate).from);
}

/** Primo e ultimo giorno (ISO) del periodo del riepilogo: servono per ritagliare il portafoglio sullo stesso periodo. */
export function digestRange(frequency: DigestFrequency, now: Date): { from: string; to: string } {
  const period = digestPeriod(frequency, now);
  const range = getPeriodRange(period.period, period.referenceDate);
  return { from: toIso(range.from), to: toIso(range.to) };
}

export interface DigestInput {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  frequency: DigestFrequency;
  now: Date;
  /** Portafoglio nel periodo, già calcolato (`buildInvestmentDigest`); null se non ci sono investimenti. */
  investments?: InvestmentDigest | null;
  /** Movimenti ancora «Da categorizzare» oggi (di qualunque data): l'email lo ricorda con un link a Categorizza. */
  toDecide?: number;
  /** Obiettivi di risparmio aperti, in breve; null o assente = non se ne parla. */
  goals?: GoalsDigest | null;
}

export interface DigestData {
  period: DigestPeriod;
  spent: number;
  income: number;
  previousSpent: number;
  topCategories: { name: string; amount: number }[];
  /** null se l'utente non ha budget; `over` = categorie con budget che hanno superato il limite nel periodo. */
  budget: { total: number; over: number } | null;
  /** Numero di movimenti nel periodo. */
  movements: number;
  investments: InvestmentDigest | null;
  /** Movimenti da decidere in Categorizza (0 o assente = niente da dire). */
  toDecide?: number;
  goals?: GoalsDigest | null;
}

/** True se il riepilogo non avrebbe niente da dire (nessun movimento e nessun investimento): in quel caso non parte. */
export function isDigestEmpty(data: DigestData): boolean {
  return data.movements === 0 && data.investments === null;
}

/** Cifre del riepilogo, calcolate con gli stessi motori delle schermate (`lib/calc/expenses`): nessun numero nuovo. */
export function buildDigest({ transactions, categories, budgets, frequency, now, investments = null, toDecide = 0, goals = null }: DigestInput): DigestData {
  const period = digestPeriod(frequency, now);
  const range = getPeriodRange(period.period, period.referenceDate);
  const previousRange = getPreviousPeriodRange(period.period, period.referenceDate);
  const spent = computeSummary(transactions, range).speseEffettive;
  const income = computeIncomeSummary(transactions, range).entrateEffettive;
  const previousSpent = computeSummary(transactions, previousRange).speseEffettive;
  const breakdown = computeCategoryBreakdown(transactions, categories, period.period, period.referenceDate, range.to);
  const topCategories = breakdown
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_CATEGORIES)
    .map((c) => ({ name: c.name, amount: c.amount }));
  const amountByCategory = new Map(breakdown.map((c) => [c.categoryId, c.amount]));
  const over = budgets.filter((b) => (amountByCategory.get(b.categoryId) ?? 0) > scaleBudgetForPeriod(Number(b.monthlyAmount), period.period)).length;
  const movements = transactions.filter((t) => {
    const date = t.date;
    return date >= toIso(range.from) && date <= toIso(range.to);
  }).length;
  return {
    period,
    spent,
    income,
    previousSpent,
    topCategories,
    budget: budgets.length === 0 ? null : { total: budgets.length, over },
    movements,
    investments,
    toDecide,
    goals,
  };
}

function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
