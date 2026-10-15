import { germanPlanSchema } from "./schema";
/** Register independently validated country models here; Italian legacy data never enters German models. */
export const PLANNING_MODELS = { DE: { schema: germanPlanSchema, version: 1, currency: "EUR" } } as const;
/** Resolve a country planning model without a fallback to another jurisdiction. */
export function planningModel(country: string) {
  return Object.hasOwn(PLANNING_MODELS, country) ? PLANNING_MODELS[country as keyof typeof PLANNING_MODELS] : null;
}
