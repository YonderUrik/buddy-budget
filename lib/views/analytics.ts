/**
 * Analitiche (Italy) computed on the server (gaps.md G9): what `AnalyticsProvider` composes in the browser from eight
 * queries — `buildAnalyticsBase`, `resolveExpectedReturn` / `withExpectedReturn`, `resolvePlan` — plus the static
 * readings of the saved plan (growth split and journey sentences, timeline series and headline). The «e se…» sliders,
 * Monte Carlo, FIRE sensitivity tables and cost drag stay on the device (ported, `domain/fire-and-simulations.md`):
 * they start from `plan` and `assumptions` here. Pure: the loader is `analytics.server.ts`.
 */
import { journeySentences, timelineHeadline, timelineSeries } from "@/components/domain/analytics/plain-answers";
import { computeAccountsKpi } from "@/components/domain/accounts/accounts-kpi.utils";
import { toDateKey } from "@/lib/calc/net-worth";
import { splitGrowth } from "@/lib/calc/growth-split";
import type { AnalyticsAssumptions } from "@/lib/analitiche/assumptions";
import { buildAnalyticsBase, type AnalyticsBaseInput } from "@/lib/analitiche/base";
import { resolveExpectedReturn, withExpectedReturn } from "@/lib/analitiche/historical-return";
import { resolvePlan } from "@/lib/analitiche/plan";
import type { Account } from "@/lib/db/schema/accounts";
import type { Language } from "@/lib/localization/config";

export interface AnalyticsViewInputs extends Omit<AnalyticsBaseInput, "liquidity" | "period"> {
  language: Language;
  accounts: Account[];
  /** Saved assumptions (with defaults), as `GET /api/analytics/assumptions` returns them. */
  stored: AnalyticsAssumptions;
  walkthroughSeen: boolean;
}

/** Builds `GET /api/analytics/base`. */
export function buildAnalyticsView(input: AnalyticsViewInputs) {
  const { stored, language } = input;
  const base = buildAnalyticsBase({ ...input, period: stored.dataPeriod, liquidity: computeAccountsKpi(input.accounts).totalLiquidity });
  const returnInfo = resolveExpectedReturn(stored, base.historicalReturn);
  const assumptions = withExpectedReturn(stored, returnInfo);
  const plan = resolvePlan(base, assumptions);
  const split = splitGrowth(base.growthPoints);
  return {
    currency: input.currency,
    today: toDateKey(input.today),
    walkthroughSeen: input.walkthroughSeen,
    /** As saved (what `PUT /api/analytics/assumptions` edits). */
    storedAssumptions: stored,
    /** In use: the saved ones with the expected return from history when it is automatic. */
    assumptions,
    returnInfo,
    base,
    plan,
    growth: { split, journey: journeySentences(plan, split.rows.length >= 2 ? split : null, input.currency, assumptions.withdrawalRate, language) },
    timeline: { headline: timelineHeadline(plan, input.today, language), series: plan.target === null ? [] : timelineSeries(plan, assumptions) },
  };
}

export type AnalyticsView = ReturnType<typeof buildAnalyticsView>;
