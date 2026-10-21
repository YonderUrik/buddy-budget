/** Settings of the pension projection (Panoramica preview and the «Proiezione» sliders), shared by the web and the API. */
import type { ProjectionRates } from "@/lib/calc/pension";

/** Constant yearly inflation used to revalue the TFR left with the employer (to come from the index with real data). */
export const ASSUMED_INFLATION = 0.02;

/** Real (after-inflation) yearly returns of the three scenarios. */
export const PENSION_PROJECTION_RATES: ProjectionRates = { prudent: 0, base: 0.02, optimistic: 0.04 };
/** Years of the Panoramica preview and the slider's starting value. */
export const PENSION_PROJECTION_DEFAULT_YEARS = 25;
export const PENSION_PROJECTION_MIN_YEARS = 1;
export const PENSION_PROJECTION_MAX_YEARS = 45;
/** Quarterly contribution slider: 0 to this, in steps of `PENSION_CONTRIBUTION_STEP`. */
export const PENSION_MAX_QUARTERLY_CONTRIBUTION = 3000;
export const PENSION_CONTRIBUTION_STEP = 20;

/** Starting value of the contribution slider: the recent quarterly contribution rounded to the step. */
export function defaultQuarterlyContribution(quarterly: number): number {
  return Math.round(quarterly / PENSION_CONTRIBUTION_STEP) * PENSION_CONTRIBUTION_STEP;
}
