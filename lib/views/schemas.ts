/**
 * Response contracts of the server-computed view endpoints for the native apps (ADR 0002 of the mobile spec,
 * `api/gaps.md` G2–G5, G11). Routes validate their payload against these in tests; clients can generate models from
 * them. Money values are JSON numbers computed in floating point (unlike the Drizzle numeric strings of raw rows),
 * dates are `YYYY-MM-DD`, timestamps ISO 8601.
 */
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.iso.datetime({ offset: true });

/** A sentence made of segments; `strong` marks the figures the screen emphasises. */
export const voiceLineSchema = z.object({
  key: z.string(),
  segments: z.array(z.object({ text: z.string(), strong: z.boolean().optional() })),
});

/** `computeMonthPace` (lib/calc/month-pace.ts). */
export const monthPaceSchema = z.object({
  spentSoFar: z.number(),
  typicalSoFar: z.number().nullable(),
  income: z.number(),
  budgetTotal: z.number().nullable(),
  budgetSpent: z.number(),
  dayOfMonth: z.number().int(),
  daysInMonth: z.number().int(),
  current: z.array(z.number()),
  typical: z.array(z.number()).nullable(),
});

export const renewalAlertSchema = z.object({
  connectionId: z.string(),
  institutionName: z.string(),
  state: z.enum(["expiring", "expired", "error"]),
  daysLeft: z.number().int().nullable(),
  /** Localized banner sentence. */
  message: z.string(),
});

export const netWorthPeriodSchema = z.enum(["1mese", "3mesi", "1anno", "max"]);

/** GET /api/overview (G2). */
export const overviewViewSchema = z.object({
  currency: z.string(),
  today: isoDate,
  period: netWorthPeriodSchema,
  includePension: z.boolean(),
  /** True when there is nothing to show yet (no account, investment or pension): the app shows «Primi passi». */
  isEmpty: z.boolean(),
  todayByClass: z.record(z.string(), z.number()),
  series: z.array(z.object({ date: isoDate, value: z.number(), byClass: z.record(z.string(), z.number()), isEstimated: z.boolean() })),
  change: z.object({ start: z.number(), end: z.number(), delta: z.number(), deltaPct: z.number().nullable() }),
  composition: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      detail: z.string(),
      amount: z.number(),
      share: z.number(),
      isLiability: z.boolean(),
      highlight: z.object({ amount: z.number(), ratio: z.number().nullable(), label: z.string() }).nullable(),
    }),
  ),
  monthLabel: z.string(),
  monthPace: monthPaceSchema,
  voice: z.array(voiceLineSchema),
  investments: z.object({ value: z.number(), positions: z.number().int(), paid: z.number(), marketGain: z.number() }).nullable(),
  pension: z.object({ value: z.number(), funds: z.number().int(), included: z.boolean() }).nullable(),
  debts: z
    .object({
      total: z.number(),
      count: z.number().int(),
      debtFreeDate: isoDate.nullable(),
      nextDue: z.array(z.object({ debtId: z.string(), name: z.string(), date: isoDate, amount: z.number(), overdue: z.boolean() })),
    })
    .nullable(),
  renewalAlerts: z.array(renewalAlertSchema),
});

export const expenseGroupKeySchema = z.enum(["dovuta", "voluta", "futuro", "saltuaria"]);

/** GET /api/liquidity/month (G3). */
export const liquidityMonthSchema = z.object({
  currency: z.string(),
  today: isoDate,
  month: z.object({ from: isoDate, to: isoDate, label: z.string() }),
  accountId: z.string().nullable(),
  /** Total balance and number of accounts («Hai X su N conti»), all accounts. */
  accounts: z.object({ total: z.number(), count: z.number().int() }),
  spent: z.number(),
  income: z.number(),
  pace: monthPaceSchema,
  /** Spending per group this month, in display order, with the localized label. */
  groups: z.array(z.object({ key: expenseGroupKeySchema, label: z.string(), amount: z.number() })),
  /** Spending on the fallback category this month («Da categorizzare»). */
  uncategorizedSpent: z.number(),
  budget: z.object({ total: z.number(), spent: z.number(), remaining: z.number() }).nullable(),
  /** One entry per category with a monthly budget, most used first. */
  budgets: z.array(
    z.object({
      categoryId: z.string(),
      name: z.string(),
      color: z.string(),
      icon: z.string(),
      group: z.string(),
      budget: z.number(),
      spent: z.number(),
      remaining: z.number(),
      /** spent / budget (can exceed 1). */
      progress: z.number(),
    }),
  ),
  /** Uncategorized transactions to fix (all time), as `/api/transactions/attention`. */
  toFix: z.number().int(),
  voice: z.array(voiceLineSchema),
});

export const expensePeriodSchema = z.enum(["settimana", "mese", "3mesi", "anno"]);

/** GET /api/liquidity/analysis (G6). */
export const liquidityAnalysisSchema = z.object({
  currency: z.string(),
  today: isoDate,
  period: expensePeriodSchema,
  accountId: z.string().nullable(),
  /** The period on screen and the one before it (same calendar length). */
  range: z.object({ from: isoDate, to: isoDate }),
  previousRange: z.object({ from: isoDate, to: isoDate }),
  /** The period is the current month: the curve has a typical line and the sentence says «Finora». */
  isCurrentMonth: z.boolean(),
  spent: z.number(),
  spentBefore: z.number(),
  /** spent − spentBefore (shown only when spentBefore > 0). */
  delta: z.number(),
  /** Cumulative effective spend, one point per day from range.from to min(range.to, today). */
  curve: z.array(z.object({ date: isoDate, value: z.number() })),
  /** Typical cumulative spend per day of month (index = day − 1), only for the current month. */
  typical: z.array(z.number()).nullable(),
  /** Spend by group (with «Da categorizzare»), largest first, empty groups left out; categories largest first. */
  groups: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      amount: z.number(),
      categories: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), icon: z.string(), amount: z.number(), budget: z.number().nullable() })),
    }),
  ),
  /** At least one category has a monthly budget («Modifica i budget» vs «Imposta un budget»). */
  hasBudgets: z.boolean(),
  incomeSources: z.array(z.object({ categoryId: z.string(), name: z.string(), color: z.string(), icon: z.string(), amount: z.number(), quotaPct: z.number().nullable() })),
  /** Cumulative income − spend per month over the trend window (6 months, 12 for `anno`), `month` = YYYY-MM. */
  savings: z.array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), cumulative: z.number() })),
  /** Last cumulative value («Messo da parte» when ≥ 0, «In meno» otherwise). */
  saved: z.number(),
  sentence: z.string(),
});

export const accountHealthSchema = z.object({
  connectionId: z.string(),
  institutionName: z.string(),
  state: z.enum(["ok", "expiring", "expired", "error", "pending"]),
  needsRenewal: z.boolean(),
  daysLeft: z.number().int().nullable(),
  consentExpiresAt: timestamp.nullable(),
  lastSyncedAt: timestamp.nullable(),
  syncing: z.boolean(),
  eligible: z.boolean(),
  nextEligibleAt: timestamp.nullable(),
  syncsRemainingToday: z.number().int(),
});

/** Extra fields of each account in `GET /api/accounts?include=trend,health` (G5). */
export const accountExtrasSchema = z.object({
  /** Bank name for linked accounts (grouping), null for manual ones. */
  bankName: z.string().nullable(),
  /** End-of-day balance for the last 30 days plus today, oldest first (linked accounts only; manual: null). */
  trend: z.array(z.number()).nullable(),
  health: accountHealthSchema.nullable(),
  /** Localized status line under the account name and its tone. */
  status: z.object({ tone: z.enum(["ok", "warning", "progress", "neutral"]), label: z.string() }),
});

/** Paged mode of GET /api/transactions (G4); items keep the legacy row shape. */
export const transactionPageSchema = z.object({
  items: z.array(
    z.looseObject({
        id: z.string(),
        accountId: z.string(),
        categoryId: z.string(),
        description: z.string(),
        amount: z.string(),
        excludedAmount: z.string(),
        date: isoDate,
        source: z.string(),
        logoPath: z.string().nullable(),
      }),
  ),
  nextCursor: z.string().nullable(),
});

export type OverviewView = z.infer<typeof overviewViewSchema>;
export type LiquidityMonth = z.infer<typeof liquidityMonthSchema>;
export type LiquidityAnalysis = z.infer<typeof liquidityAnalysisSchema>;
export type AccountExtras = z.infer<typeof accountExtrasSchema>;
export type AccountHealth = z.infer<typeof accountHealthSchema>;
export type TransactionPage = z.infer<typeof transactionPageSchema>;
