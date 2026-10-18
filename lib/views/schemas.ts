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

const withdrawalScenarioSchema = z.object({ reason: z.enum(["pensionamento", "sanitarie", "altri"]), rate: z.number(), netLow: z.number(), netHigh: z.number() });
const projectionPointSchema = z.object({ year: z.number().int(), prudent: z.number(), base: z.number(), optimistic: z.number() });
const sliderSchema = z.object({ min: z.number(), max: z.number(), step: z.number(), default: z.number() });

/** GET /api/pension/view (G10). */
export const pensionViewSchema = z.object({
  currency: z.string(),
  today: isoDate,
  funds: z.array(z.object({ id: z.string(), name: z.string(), adhesionDate: isoDate, snapshotCount: z.number().int(), lastDate: isoDate.nullable() })),
  fund: z.object({ id: z.string(), name: z.string(), adhesionDate: isoDate, snapshots: z.array(z.object({ id: z.string(), date: isoDate, netContributions: z.number(), value: z.number() })) }).nullable(),
  last: z.object({ id: z.string(), date: isoDate, netContributions: z.number(), value: z.number() }).nullable(),
  performance: z
    .object({ value: z.number(), netContributions: z.number(), gain: z.number(), gainPct: z.number().nullable(), annualReturn: z.number().nullable(), approximate: z.boolean(), firstDate: isoDate, lastDate: isoDate })
    .nullable(),
  contributions: z.array(z.object({ date: isoDate, amount: z.number(), estimated: z.boolean() })),
  scenarios: z.array(withdrawalScenarioSchema),
  tfr: z.object({ gross: z.number(), net: z.number(), annualRate: z.number() }).nullable(),
  assumedInflation: z.number(),
  quarterly: z.number(),
  yearly: z.array(z.object({ year: z.number().int(), contributions: z.number(), gain: z.number(), endValue: z.number(), returnRate: z.number().nullable(), partial: z.boolean() })),
  projection: z.object({
    preview: projectionPointSchema.nullable(),
    years: z.number().int(),
    rates: z.object({ prudent: z.number(), base: z.number(), optimistic: z.number() }),
    sliders: z.object({ years: sliderSchema, quarterlyContribution: sliderSchema }),
  }),
  exitTax: z.object({
    realYears: z.number().int(),
    rate: z.number(),
    milestones: z.object({ reductionStartsOn: isoDate, minRateOn: isoDate }).nullable(),
    maxYears: z.number().int(),
    timeline: z.array(z.object({ years: z.number().int(), rate: z.number(), scenarios: z.array(withdrawalScenarioSchema) })),
  }),
});

const exitPlanSchema = z.object({
  steps: z.array(z.object({ id: z.string(), name: z.string(), endDate: isoDate, baselineEndDate: isoDate, monthsSaved: z.number().int() })),
  endDate: isoDate,
  baselineEndDate: isoDate,
  interestSaved: z.number(),
});

/** `insights` of GET /api/debts?include=insights (G12). */
export const debtsInsightsSchema = z.object({
  interestShares: z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), yearly: z.number(), share: z.number() })), total: z.number() }),
  repaid: z.array(z.object({ debtId: z.string(), share: z.number() })),
  exit: z.object({
    loans: z.array(z.object({ id: z.string(), name: z.string(), residual: z.number(), annualRate: z.number(), installment: z.number() })),
    slider: z.object({ min: z.number(), max: z.number(), step: z.number(), default: z.number() }),
    extras: z.array(z.number()),
    plans: z.array(exitPlanSchema.nullable()),
  }),
});

/** GET /api/analytics/base (G9). Engine objects are loose: their own tests pin them. */
export const analyticsViewSchema = z.object({
  currency: z.string(),
  today: isoDate,
  walkthroughSeen: z.boolean(),
  storedAssumptions: z.looseObject({ expectedReturn: z.number(), withdrawalRate: z.number(), expectedReturnAuto: z.boolean(), dataPeriod: z.looseObject({ kind: z.string() }) }),
  assumptions: z.looseObject({ expectedReturn: z.number(), withdrawalRate: z.number() }),
  returnInfo: z.looseObject({ value: z.number(), source: z.enum(["storico", "prudente", "manuale"]), clamped: z.boolean(), high: z.boolean() }),
  base: z.looseObject({
    currency: z.string(),
    wealth: z.object({ liquidity: z.number(), investments: z.number(), pension: z.number(), debts: z.number() }),
    cashflow: z.looseObject({ annualIncome: z.number(), annualSpending: z.number(), annualSavings: z.number(), savingsRate: z.number().nullable(), monthsWithData: z.number().int() }),
  }),
  plan: z.looseObject({
    spending: z.number().nullable(),
    savings: z.number().nullable(),
    wealth: z.number(),
    taxShare: z.number(),
    fireNumberGross: z.number().nullable(),
    target: z.number().nullable(),
    progress: z.number().nullable(),
    yearsToFire: z.number().nullable(),
    coast: z.array(z.object({ years: z.number(), number: z.number() })),
  }),
  growth: z.object({ split: z.looseObject({ rows: z.array(z.looseObject({})) }), journey: z.array(z.string()) }),
  timeline: z.object({ headline: z.string(), series: z.array(z.object({ year: z.number().int(), wealth: z.number() })) }),
});

const countryMetaSchema = z.object({
  id: z.enum(["IT", "DE"]),
  languages: z.array(z.enum(["it", "en", "de"])),
  features: z.object({ taxes: z.boolean(), pension: z.boolean(), retirement: z.boolean(), incomeForecasts: z.boolean(), inflation: z.boolean() }),
  sections: z.record(z.string(), z.boolean()),
  planning: z.object({ tax: z.boolean(), income: z.boolean(), pension: z.boolean(), retirement: z.boolean(), simulations: z.boolean() }),
});

/** GET /api/meta (G13). */
export const appMetaSchema = z.object({
  language: z.enum(["it", "en", "de"]),
  server: z.object({ version: z.string(), commit: z.string(), builtAt: z.string() }),
  legal: z.looseObject({ version: z.string() }),
  languages: z.array(z.object({ id: z.enum(["it", "en", "de"]), name: z.string(), locale: z.string() })),
  countries: z.array(countryMetaSchema),
  currencies: z.array(z.object({ value: z.string(), label: z.string(), symbol: z.string() })),
  defaultCurrency: z.string(),
  homePages: z.array(z.object({ path: z.string(), label: z.string() })),
  defaultHomePage: z.string(),
  notifications: z.object({
    defaults: z.object({ digestEnabled: z.boolean(), digestFrequency: z.string(), budgetAlertsEnabled: z.boolean(), deadlineAlertsEnabled: z.boolean(), goalAlertsEnabled: z.boolean() }),
    kinds: z.array(z.object({ id: z.string(), label: z.string(), hint: z.string() })),
    digestFrequencies: z.array(z.string()),
    budgetAlertThresholds: z.array(z.number()),
    deadlineLeadDays: z.number().int(),
    alertsMaxPerWeek: z.number().int(),
  }),
  limits: z.record(z.string(), z.number()),
  features: z.array(z.object({ id: z.string(), area: z.string(), areaLabel: z.string(), name: z.string(), description: z.string(), status: z.enum(["live", "new", "soon"]), appPath: z.string().nullable(), available: z.boolean().nullable() })),
  profile: z
    .object({
      productCountry: z.enum(["IT", "DE"]),
      language: z.enum(["it", "en", "de"]),
      capabilities: countryMetaSchema,
      categoryProposal: z.array(z.looseObject({ key: z.string().nullable(), name: z.string() })),
    })
    .nullable(),
});

const whatsNewEntrySchema = z.object({ id: z.string(), date: isoDate, title: z.string(), summary: z.string(), href: z.string(), ctaLabel: z.string() });

/** GET /api/whats-new (G14). */
export const whatsNewSchema = z.object({ maxAgeDays: z.number().int(), entries: z.array(whatsNewEntrySchema), current: whatsNewEntrySchema.nullable() });

/** POST /api/gocardless/connections (R6: `connectionId` and `client` added for the native return). */
export const bankConnectionStartSchema = z.object({
  link: z.url(),
  connectionId: z.uuid(),
  client: z.enum(["web", "native"]),
});

/** GET /api/gocardless/connections/{id}/accounts: the «Conti trovati» selection. */
export const bankConnectionAccountsSchema = z.object({
  externalAccounts: z.array(
    z.object({
      externalAccountId: z.string(),
      details: z.object({ iban: z.string().optional(), name: z.string().optional(), product: z.string().optional() }).loose(),
    })
  ),
  existingAutoAccounts: z.array(z.object({ id: z.uuid(), name: z.string() })),
});

/** POST /api/gocardless/connections/{id}/complete (R6): the consent is linked, plus the accounts to select. */
export const bankConnectionCompletedSchema = bankConnectionAccountsSchema.extend({
  connectionId: z.uuid(),
  status: z.literal("linked"),
  institutionId: z.string(),
  institutionName: z.string(),
  consentExpiresAt: timestamp.nullable(),
});

export type OverviewView = z.infer<typeof overviewViewSchema>;
export type LiquidityMonth = z.infer<typeof liquidityMonthSchema>;
export type LiquidityAnalysis = z.infer<typeof liquidityAnalysisSchema>;
export type AccountExtras = z.infer<typeof accountExtrasSchema>;
export type AccountHealth = z.infer<typeof accountHealthSchema>;
export type TransactionPage = z.infer<typeof transactionPageSchema>;
