import { isSelfHosted } from "@/lib/instance/config";
import { LEGAL_VERSION, needsLegalAcceptance } from "@/lib/legal/version";
import { isPublicDemoUserId } from "@/lib/public-demo/config";

/** Stable code of the 403 the proxy returns to API calls of a deactivated account (deletion pending). */
export const ACCOUNT_DEACTIVATED_CODE = "account_deactivated";
/** Stable code of the 403 the proxy returns to API calls until the current legal documents are accepted. */
export const LEGAL_ACCEPTANCE_REQUIRED_CODE = "legal_acceptance_required";
/** Gate of a user who has not finished onboarding: pages go to `/onboarding`, the API is not blocked. */
export const ONBOARDING_REQUIRED_CODE = "onboarding_required";

export type AccountGate = typeof ACCOUNT_DEACTIVATED_CODE | typeof LEGAL_ACCEPTANCE_REQUIRED_CODE | typeof ONBOARDING_REQUIRED_CODE;

/** The account fields the gates read (better-auth additional fields of the session user). */
export interface GateUser {
  id?: string | null;
  onboardingCompleted?: boolean | null;
  deletionScheduledAt?: Date | string | null;
  legalAcceptedVersion?: string | null;
}

/**
 * First account gate that applies to the user, in the order the proxy enforces them: deactivated account, then the
 * legal re-acceptance (only after onboarding: new users accept during onboarding), then onboarding. Null when the
 * user can use the app. Single source for `proxy.ts` and `GET /api/me/bootstrap`. Self-hosted installs are run by
 * whoever installed them, not under the hosted service's Terms: they never get the legal gate. Neither do the public
 * demo accounts: visitors use them without an account, and being read-only they could not record an acceptance.
 */
export function accountGate(user: GateUser, currentLegalVersion: string = LEGAL_VERSION, selfHosted: boolean = isSelfHosted()): AccountGate | null {
  if (user.deletionScheduledAt) return ACCOUNT_DEACTIVATED_CODE;
  if (user.onboardingCompleted && !selfHosted && !isPublicDemoUserId(user.id) && needsLegalAcceptance(user.legalAcceptedVersion, currentLegalVersion)) return LEGAL_ACCEPTANCE_REQUIRED_CODE;
  if (!user.onboardingCompleted) return ONBOARDING_REQUIRED_CODE;
  return null;
}

/** JSON body of the proxy's 403 for a blocking gate, so API clients can tell the two gates apart. */
export function accountGateErrorBody(gate: typeof ACCOUNT_DEACTIVATED_CODE | typeof LEGAL_ACCEPTANCE_REQUIRED_CODE): { code: string; version?: string } {
  return gate === LEGAL_ACCEPTANCE_REQUIRED_CODE ? { code: gate, version: LEGAL_VERSION } : { code: gate };
}
