/**
 * Results of the German financial plan computed on the server (gaps.md §5, «DE financial planning»): what the Tasse
 * and Proventi planning sections compute in the browser from the plan document and the investment data —
 * `germanPortfolioReport` (FIFO per custody account, issues, 2026 capital-tax estimate) and `germanIncomeForecast` — for
 * the sections the rollout switches enable (`isPlanningAvailable`). The editors stay on the device; this is what they
 * show around the inputs. Pure: the loader is `financial-planning.server.ts`.
 */
import { germanFundAdvance, germanIncomeForecast, germanPortfolioReport, type GermanPlan } from "@/lib/financial-planning";
import type { InvestmentData } from "@/lib/investments/data";
import { isPlanningAvailable } from "@/lib/localization/planning-availability";

/** Currency the German models compute in: other account currencies get no results (as on the web). */
export const PLANNING_CURRENCY = "EUR";
/** Tax year of the German rules (`germanRules` only knows 2026). */
export const PLANNING_TAX_YEAR = "2026";

/** Results for `plan` on `data` at `today` (`YYYY-MM-DD`, UTC day as on the web). */
export function buildPlanningResults(plan: GermanPlan, data: InvestmentData, today: string) {
  const sections = {
    tax: isPlanningAvailable("DE", "tax"),
    income: isPlanningAvailable("DE", "income"),
    pension: isPlanningAvailable("DE", "pension"),
    retirement: isPlanningAvailable("DE", "retirement"),
    simulations: isPlanningAvailable("DE", "simulations"),
  };
  if (data.currency !== PLANNING_CURRENCY) return { currency: data.currency, supported: false as const, sections, tax: null, income: null };
  const funds = data.instruments.filter((i) => ["etf", "fondo"].includes(i.type) && data.transactions.some((t) => t.instrumentId === i.id));
  const fundIds = new Set(funds.map((f) => f.id));
  // Without simulations the income forecast is limited to validated tax years, as the web forces it.
  const incomeProfile = sections.simulations ? plan.tax : { ...plan.tax, futureForecast: "verified" as const };
  return {
    currency: data.currency,
    supported: true as const,
    sections,
    tax: sections.tax
      ? {
          report: germanPortfolioReport(data, plan.tax, today),
          /** Vorabpauschale scenario: only shown with simulations. */
          fundAdvance: sections.simulations ? germanFundAdvance(plan.fund) : null,
          /** Funds to classify (equity/mixed/…) and the 2026 fund sales that take prior advances. */
          fundInstrumentIds: funds.map((f) => f.id),
          fundSaleIds: data.transactions.filter((t) => t.type === "vendita" && t.date.startsWith(PLANNING_TAX_YEAR) && fundIds.has(t.instrumentId)).map((t) => t.id),
        }
      : null,
    income: sections.income ? germanIncomeForecast(data, incomeProfile, today) : null,
  };
}

export type PlanningResults = ReturnType<typeof buildPlanningResults>;
