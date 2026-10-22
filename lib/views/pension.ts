/**
 * Pensione (Italy) computed on the server (gaps.md G10): what `PensionProvider` and the Pensione tabs compute in the
 * browser for one fund — performance, derived contributions, withdrawal estimates, TFR-in-company comparison, recent
 * quarterly contribution, the 25-year projection preview, the yearly breakdown — plus the exit-tax timeline for every
 * whole year 0–35, so the drag on «Scenari» only indexes into it. The projection sliders stay client-side
 * (`projectPension`, ported; their settings are returned). Pure: the loader is `pension.server.ts`.
 */
import {
  companyTfrValue,
  computePensionPerformance,
  deriveContributions,
  EXIT_TAX_TIMELINE_YEARS,
  exitTaxMilestones,
  exitTaxRate,
  projectPension,
  recentQuarterlyContribution,
  wholeYearsBetween,
  withdrawalScenarios,
  yearlyBreakdown,
} from "@/lib/calc/pension";
import {
  ASSUMED_INFLATION,
  defaultQuarterlyContribution,
  PENSION_CONTRIBUTION_STEP,
  PENSION_MAX_QUARTERLY_CONTRIBUTION,
  PENSION_PROJECTION_DEFAULT_YEARS,
  PENSION_PROJECTION_MAX_YEARS,
  PENSION_PROJECTION_MIN_YEARS,
  PENSION_PROJECTION_RATES,
} from "@/lib/pension/projection";
import type { PensionFundData } from "@/lib/pension/types";

export interface PensionViewInputs {
  /** `YYYY-MM-DD`; the web uses the UTC day (`todayIso`). */
  today: string;
  currency: string;
  funds: PensionFundData[];
  /** The fund to compute; null for the first one, as the web selects it. */
  fundId: string | null;
}

/** Builds the Pensione view; `fund` is null when the user has no fund (or `fundId` is not one of theirs). */
export function buildPensionView(input: PensionViewInputs) {
  const { today, funds } = input;
  const fund = (input.fundId ? funds.find((f) => f.id === input.fundId) : funds[0]) ?? null;
  const snapshots = fund?.snapshots ?? [];
  const last = snapshots.at(-1) ?? null;
  const adhesion = fund?.adhesionDate ?? null;
  const contributions = deriveContributions(snapshots, adhesion);
  const quarterly = recentQuarterlyContribution(snapshots) ?? 0;
  const realYears = adhesion ? wholeYearsBetween(adhesion, today) : 0;
  const projectionEnd = last
    ? projectPension({ startValue: last.value, quarterlyContribution: quarterly, years: PENSION_PROJECTION_DEFAULT_YEARS, rates: PENSION_PROJECTION_RATES }).at(-1) ?? null
    : null;

  return {
    currency: input.currency,
    today,
    funds: funds.map((f) => ({ id: f.id, name: f.name, adhesionDate: f.adhesionDate, snapshotCount: f.snapshots.length, lastDate: f.snapshots.at(-1)?.date ?? null })),
    fund,
    last,
    performance: computePensionPerformance(snapshots, adhesion),
    contributions,
    scenarios: last ? withdrawalScenarios(last.value, last.netContributions, adhesion, today) : [],
    tfr: last ? companyTfrValue(contributions, last.date, ASSUMED_INFLATION) : null,
    assumedInflation: ASSUMED_INFLATION,
    quarterly,
    yearly: yearlyBreakdown(snapshots),
    projection: {
      /** Panoramica preview: value after the default years in each scenario, with the recent quarterly contribution. */
      preview: projectionEnd,
      years: PENSION_PROJECTION_DEFAULT_YEARS,
      rates: PENSION_PROJECTION_RATES,
      /** «Proiezione» sliders (computed on the device with `projectPension`). */
      sliders: {
        years: { min: PENSION_PROJECTION_MIN_YEARS, max: PENSION_PROJECTION_MAX_YEARS, step: 1, default: PENSION_PROJECTION_DEFAULT_YEARS },
        quarterlyContribution: { min: 0, max: PENSION_MAX_QUARTERLY_CONTRIBUTION, step: PENSION_CONTRIBUTION_STEP, default: defaultQuarterlyContribution(quarterly) },
      },
    },
    exitTax: {
      realYears,
      rate: exitTaxRate(realYears),
      milestones: adhesion ? exitTaxMilestones(adhesion) : null,
      maxYears: EXIT_TAX_TIMELINE_YEARS,
      /** One entry per whole year of participation 0–35: the rate and the withdrawal estimates with that many years. */
      timeline: Array.from({ length: EXIT_TAX_TIMELINE_YEARS + 1 }, (_, years) => ({
        years,
        rate: exitTaxRate(years),
        scenarios: last ? withdrawalScenarios(last.value, last.netContributions, adhesion, today, years) : [],
      })),
    },
  };
}

export type PensionView = ReturnType<typeof buildPensionView>;
