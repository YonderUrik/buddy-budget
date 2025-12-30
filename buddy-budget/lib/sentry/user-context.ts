import type { Session } from "next-auth";

import * as Sentry from "@sentry/nextjs";

/**
 * Set Sentry user context from NextAuth session
 * Only tracks user ID, no PII (email, name, etc.)
 */
export function setSentryUser(session: Session | null): void {
  if (!session?.user?.id) {
    // Clear user context if no session
    Sentry.setUser(null);

    return;
  }

  Sentry.setUser({
    id: session.user.id,
    // DO NOT include email, name, or other PII
  });
}

/**
 * Set additional context (non-PII)
 */
export function setSentryContext(data: {
  onboardingCompleted?: boolean;
  onboardingStep?: string;
  provider?: string;
}): void {
  Sentry.setContext("user_metadata", {
    onboarding_completed: data.onboardingCompleted,
    onboarding_step: data.onboardingStep,
    auth_provider: data.provider,
  });
}

/**
 * Clear all user context (on sign out)
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
  Sentry.setContext("user_metadata", null);
}
