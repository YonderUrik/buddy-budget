import { isPublicDemoUserId } from "@/lib/public-demo/config";
import { resolvePlan, type PlanUserFields, type PlanView } from "./access";
import { billingConfig, isPlanEnforcedFor, type BillingConfig } from "./config";

/** The session user fields the plan depends on. */
export interface PlanSessionUser extends PlanUserFields {
  id: string;
  email?: string | null;
}

/**
 * Plan of a signed-in account: Free/Pro only where billing applies (hosted with Stripe on, or pilot with this email);
 * the shared public demo accounts always see everything. The one function the proxy, the layout and the routes use.
 */
export function planForUser(user: PlanSessionUser, now: Date = new Date(), config: BillingConfig = billingConfig()): PlanView {
  const enforced = !isPublicDemoUserId(user.id) && isPlanEnforcedFor(user.email, config);
  return resolvePlan(user, enforced, now);
}
