/**
 * Liquidità · Analisi computed on the server (gaps.md G6): the same functions `app/(app)/liquidita/analisi/page.tsx`
 * runs in the browser — period spend against the period before, cumulative curve against the typical month, spend by
 * group and category (budgets scaled to the period), income sources, accumulated savings and the sentence. Pure: the
 * loader is `liquidity-analysis.server.ts`.
 */
import { computeAccumulatedSavings, computeIncomeSources } from "@/lib/calc/cashflow";
import {
  computeCategoryBreakdown,
  computeSummary,
  filterTransactions,
  getPeriodRange,
  getPreviousPeriodRange,
  isExpense,
  scaleBudgetForPeriod,
  type ExpensePeriod,
} from "@/lib/calc/expenses";
import { computeMonthPace } from "@/lib/calc/month-pace";
import { getTrendRange } from "@/lib/calc/movements";
import { toDateKey } from "@/lib/calc/net-worth";
import { EXPENSE_GROUP_KEYS, GROUP_DISPLAY, UNCATEGORIZED_GROUP_KEY, type CategoryGroupKey } from "@/lib/categories/groups";
import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { buildAnalysisSentence } from "@/lib/liquidity/analysis-sentence";
import { buildCumulativeSpend } from "@/lib/liquidity/spend-curve";
import type { Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import type { LiquidityAnalysis } from "./schemas";

/** Periods of the Analisi stepper, as `ExpensePeriod`. */
export const ANALYSIS_PERIODS: readonly ExpensePeriod[] = ["settimana", "mese", "3mesi", "anno"];

export interface LiquidityAnalysisInputs {
  today: Date;
  period: ExpensePeriod;
  /** Any day inside the period on screen (the stepper's reference date). */
  referenceDate: Date;
  accountId: string | null;
  currency: string;
  language: Language;
  /** The user's transactions in `liquidityFetchWindow(referenceDate)`, as the web fetches them. */
  transactions: Transaction[];
  /** Categories with names in the user's language. */
  categories: Category[];
  budgets: Budget[];
}

const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}`;

/** Builds the Analisi view from loaded data. */
export function buildLiquidityAnalysis(input: LiquidityAnalysisInputs): LiquidityAnalysis {
  const { today, period, referenceDate, categories, budgets, language } = input;
  const scoped = filterTransactions(input.transactions, { categoryId: null, searchText: "", accountId: input.accountId });
  const range = getPeriodRange(period, referenceDate);
  const previous = getPreviousPeriodRange(period, referenceDate);
  const spent = computeSummary(scoped, range).speseEffettive;
  const spentBefore = computeSummary(scoped, previous).speseEffettive;
  const curve = buildCumulativeSpend(scoped, range, today);
  const isCurrentMonth = period === "mese" && range.from.getTime() <= today.getTime() && today.getTime() <= range.to.getTime();
  const typical = isCurrentMonth ? computeMonthPace(scoped, budgets, today).typical : null;

  const breakdown = computeCategoryBreakdown(scoped.filter(isExpense), categories, period, referenceDate, today)
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const heaviest = breakdown[0] ?? null;
  const budgetById = new Map(budgets.filter((b) => Number(b.monthlyAmount) > 0).map((b) => [b.categoryId, scaleBudgetForPeriod(Number(b.monthlyAmount), period)]));
  const groups = ([...EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY] as CategoryGroupKey[])
    .map((key) => {
      const items = breakdown.filter((c) => c.group === key);
      return {
        key,
        label: translate(language, GROUP_DISPLAY[key].label),
        amount: items.reduce((sum, c) => sum + c.amount, 0),
        categories: items.map((c) => ({ id: c.categoryId, name: c.name, color: c.color, icon: c.icon, amount: c.amount, budget: budgetById.get(c.categoryId) ?? null })),
      };
    })
    .filter((g) => g.amount > 0)
    .sort((x, y) => y.amount - x.amount);

  const incomeSources = computeIncomeSources(scoped, categories, range).map(({ categoryId, name, color, icon, amount, quotaPct }) => ({ categoryId, name, color, icon, amount, quotaPct }));
  const savings = computeAccumulatedSavings(scoped, getTrendRange(period, referenceDate)).map((entry) => ({ month: monthKey(entry.year, entry.month), cumulative: entry.cumulative }));
  const saved = savings.length > 0 ? savings[savings.length - 1].cumulative : 0;

  return {
    currency: input.currency,
    today: toDateKey(today),
    period,
    accountId: input.accountId,
    range: { from: toDateKey(range.from), to: toDateKey(range.to) },
    previousRange: { from: toDateKey(previous.from), to: toDateKey(previous.to) },
    isCurrentMonth,
    spent,
    spentBefore,
    delta: spent - spentBefore,
    curve,
    typical,
    groups,
    hasBudgets: budgetById.size > 0,
    incomeSources,
    savings,
    saved,
    sentence: buildAnalysisSentence({ language, currency: input.currency, spent, spentBefore, isCurrentMonth, heaviest }),
  };
}
