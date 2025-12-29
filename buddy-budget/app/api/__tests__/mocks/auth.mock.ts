import { Session } from "next-auth";

import { OnboardingStep, AuthProvider } from "@/lib/auth";

/**
 * Mock authenticated session for testing
 */
export const mockAuthenticatedSession: Session = {
  user: {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    image: "https://example.com/avatar.jpg",
    onboardingCompleted: false,
    onboardingStep: OnboardingStep.WELCOME,
    provider: AuthProvider.GOOGLE,
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

/**
 * Mock unauthenticated session (null)
 */
export const mockUnauthenticatedSession = null;

/**
 * Factory function to create custom sessions for testing
 */
export function createMockSession(
  overrides: Partial<Session["user"]> = {},
): Session {
  return {
    ...mockAuthenticatedSession,
    user: {
      ...mockAuthenticatedSession.user,
      ...overrides,
    },
  };
}

/**
 * Factory function to create mock auth function
 */
export function createMockAuth(
  session: Session | null = mockAuthenticatedSession,
): jest.Mock {
  return jest.fn(() => Promise.resolve(session));
}
