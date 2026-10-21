/**
 * The month column of Liquidità · Movimenti computed on the server (gaps.md G3): the same functions
 * `app/(app)/liquidita/page.tsx` and `LiquidityOverview` run in the browser, plus the per-category budget progress the
 * web shows in Analisi (spend this month against the monthly budget). Pure: the loader is `liquidity-month.server.ts`.
 */
import { computeAccountsKpi } from "@/components/domain/accounts/accounts-kpi.utils";
import { computeMonthPace } from "@/lib/calc/month-pace";
import {
  computeCategoryBreakdown,
  computeGroupTotals,
  computeIncomeSummary,
  computeKpis,
  computeSummary,
  endOfMonth,
  filterTransactions,
  startOfMonth,
} from "@/lib/calc/expenses";
import { toDateKey } from "@/lib/calc/net-worth";
import { EXPENSE_GROUPS, EXPENSE_GROUP_KEYS, UNCATEGORIZED_GROUP_KEY } from "@/lib/categories/groups";
import type { Account } from "@/lib/db/schema/accounts";
import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";
import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import { buildVoiceLines } from "@/lib/overview/voice";
import type { LiquidityMonth } from "./schemas";

export interface LiquidityMonthInputs {
  today: Date;
  /** Only this account's movements, as the account chips on the web; null for all accounts. */
  accountId: string | null;
  currency: string;
  language: Language;
  accounts: Account[];
  /** All the user's transactions from MONTH_PACE_LOOKBACK months before this month to its end. */
  transactions: Transaction[];
  /** Categories with names in the user's language. */
  categories: Category[];
  budgets: Budget[];
  /** Uncategorized transactions to fix, from the attention summary. */
  toFix: number;
}

/** Builds the month figures, pace, group totals and budget progress. */
export function buildLiquidityMonth(input: LiquidityMonthInputs): LiquidityMonth {
  const { today, language } = input;
  const locale = LANGUAGE_LOCALES[language];
  const month = { from: startOfMonth(today), to: endOfMonth(today) };
  const scoped = filterTransactions(input.transactions, { categoryId: null, searchText: "", accountId: input.accountId });
  const pace = computeMonthPace(scoped, input.budgets, today);
  const totals = computeGroupTotals(scoped, input.categories, "mese", today, today);
  const breakdown = new Map(computeCategoryBreakdown(scoped, input.categories, "mese", today, today).map((row) => [row.categoryId, row]));
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));

  const budgets = input.budgets
    .filter((budget) => Number(budget.monthlyAmount) > 0 && categoryById.has(budget.categoryId))
    .map((budget) => {
      const category = categoryById.get(budget.categoryId)!;
      const amount = Number(budget.monthlyAmount);
      const spent = breakdown.get(budget.categoryId)?.amount ?? 0;
      return {
        categoryId: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
        group: breakdown.get(budget.categoryId)?.group ?? category.type,
        budget: amount,
        spent,
        remaining: amount - spent,
        progress: spent / amount,
      };
    })
    .sort((a, b) => b.progress - a.progress);
  const kpis = computeKpis(scoped, input.budgets, "mese", today, today);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long" }).format(today);
  // The sentence above the feed describes the whole month (all accounts), as on the web.
  const voicePace = input.accountId ? computeMonthPace(input.transactions, input.budgets, today) : pace;

  return {
    currency: input.currency,
    today: toDateKey(today),
    month: { from: toDateKey(month.from), to: toDateKey(month.to), label: monthLabel },
    accountId: input.accountId,
    accounts: { total: computeAccountsKpi(input.accounts).totalLiquidity, count: input.accounts.length },
    spent: computeSummary(scoped, month).speseEffettive,
    income: computeIncomeSummary(scoped, month).entrateEffettive,
    pace,
    groups: EXPENSE_GROUP_KEYS.map((key) => ({ key, label: translate(language, EXPENSE_GROUPS[key].label), amount: totals[key] })),
    uncategorizedSpent: totals[UNCATEGORIZED_GROUP_KEY],
    budget: kpis.budgetRimanente === null ? null : { total: kpis.budgetTotale, spent: kpis.budgetTotale - kpis.budgetRimanente, remaining: kpis.budgetRimanente },
    budgets,
    toFix: input.toFix,
    voice: buildVoiceLines({ language, pace: voicePace, monthLabel, currency: input.currency, nextDue: null, today }),
  };
}
