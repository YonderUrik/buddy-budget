/**
 * lib/billing — barrel file (safe in the browser)
 *
 * Free and Pro plans: Free opens Liquidità, Pro opens everything (14 free days, 1,99 €/month or 20 €/year via Stripe).
 * Plan rules, prices and the plan of an account. Server-only parts (Stripe, database, webhooks) are in `./server`.
 * Living doc: docs/architecture/billing.md.
 */

export { PRO_TRIAL_DAYS, PRO_PRICE_CENTS, PRO_PRICE_CURRENCY, PAST_DUE_GRACE_DAYS, RENEWAL_GRACE_HOURS, PRO_SOURCES, yearlySavingPercent } from "./plans";
export type { ProSource } from "./plans";
export { PRO_AREAS, PRO_PAGE_PATH, FREE_HOME_PATH, proAreaOf, isProPath, isPlanPathAvailable, parseProArea } from "./plan-routes";
export type { ProAreaId } from "./plan-routes";
export { resolvePlan, OPEN_PLAN } from "./access";
export type { PlanTier, PlanView, PlanUserFields } from "./access";
export { PLAN_REQUIRED_CODE } from "./constants";
export { normalizeAccessCode, ACCESS_CODE_MAX_LENGTH } from "./access-codes";
export type { AccessCodeRejection } from "./access-codes";
export { formatProPrice } from "./format";
