import { PRO_SOURCES, type ProSource } from "./plans";

/** The two plans. */
export type PlanTier = "free" | "pro";

/** What the app knows about the plan of the signed-in account (sent to the browser by the app layout). */
export interface PlanView {
  /** Plan that decides what opens. Always `pro` when billing does not apply to this account. */
  tier: PlanTier;
  /** True when Free/Pro applies to this account (billing on, or pilot with this email); false = everything open, no plan UI. */
  enforced: boolean;
  /** Where the Pro access comes from; null on Free or when the plan is not enforced. */
  source: ProSource | null;
  /** End of the current Pro access (ISO); null on Free, for a grant without an end, or when not enforced. */
  until: string | null;
}

/** Fields of `auth_user` the plan is read from (all on the session user). */
export interface PlanUserFields {
  proUntil?: Date | string | null;
  proSource?: string | null;
}

/** Year after which a Pro access counts as "for good" (grants without an end are stored with a far-future date). */
const FOR_GOOD_AFTER_YEAR = 9000;

/** Plan of an account at `now`. `enforced` false (billing off, self-hosted, outside the pilot) means Pro, unconditionally. */
export function resolvePlan(user: PlanUserFields | null | undefined, enforced: boolean, now: Date = new Date()): PlanView {
  if (!enforced) return { tier: "pro", enforced: false, source: null, until: null };
  const until = user?.proUntil ? new Date(user.proUntil) : null;
  if (!until || Number.isNaN(until.getTime()) || until.getTime() <= now.getTime()) return { tier: "free", enforced: true, source: null, until: null };
  const source = PRO_SOURCES.includes(user?.proSource as ProSource) ? (user!.proSource as ProSource) : "grant";
  return { tier: "pro", enforced: true, source, until: until.getUTCFullYear() >= FOR_GOOD_AFTER_YEAR ? null : until.toISOString() };
}

/** Plan used where no account is known (tests, previews): everything open. */
export const OPEN_PLAN: PlanView = { tier: "pro", enforced: false, source: null, until: null };
