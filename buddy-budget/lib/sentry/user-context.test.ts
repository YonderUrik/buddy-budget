// Mock Sentry before imports
jest.mock("@sentry/nextjs", () => ({
  setUser: jest.fn(),
  setContext: jest.fn(),
}));

import type { Session } from "next-auth";

import * as Sentry from "@sentry/nextjs";

import {
  setSentryUser,
  setSentryContext,
  clearSentryUser,
} from "./user-context";

// Type assertions for mocked functions
const mockSetUser = Sentry.setUser as jest.MockedFunction<
  typeof Sentry.setUser
>;
const mockSetContext = Sentry.setContext as jest.MockedFunction<
  typeof Sentry.setContext
>;

describe("Sentry User Context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("setSentryUser", () => {
    it("should set user context with only user ID from session", () => {
      const session: Session = {
        user: {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          image: "https://example.com/avatar.jpg",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      expect(mockSetUser).toHaveBeenCalledTimes(1);
      expect(mockSetUser).toHaveBeenCalledWith({
        id: "user-123",
      });

      // Verify NO PII is sent
      const callArgs = mockSetUser.mock.calls[0][0];

      expect(callArgs).not.toHaveProperty("email");
      expect(callArgs).not.toHaveProperty("name");
      expect(callArgs).not.toHaveProperty("image");
    });

    it("should clear user context when session is null", () => {
      setSentryUser(null);

      expect(mockSetUser).toHaveBeenCalledTimes(1);
      expect(mockSetUser).toHaveBeenCalledWith(null);
    });

    it("should clear user context when session has no user", () => {
      const sessionWithoutUser = {
        expires: "2024-12-31T23:59:59.999Z",
      } as Session;

      setSentryUser(sessionWithoutUser);

      expect(mockSetUser).toHaveBeenCalledTimes(1);
      expect(mockSetUser).toHaveBeenCalledWith(null);
    });

    it("should clear user context when user has no ID", () => {
      const session: Session = {
        user: {
          email: "test@example.com",
          name: "Test User",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      expect(mockSetUser).toHaveBeenCalledTimes(1);
      expect(mockSetUser).toHaveBeenCalledWith(null);
    });

    it("should handle session with minimal user data", () => {
      const session: Session = {
        user: {
          id: "minimal-user",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      expect(mockSetUser).toHaveBeenCalledTimes(1);
      expect(mockSetUser).toHaveBeenCalledWith({
        id: "minimal-user",
      });
    });

    it("should handle empty string user ID", () => {
      const session: Session = {
        user: {
          id: "",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      // Empty string is falsy, should clear user
      expect(mockSetUser).toHaveBeenCalledTimes(1);
      expect(mockSetUser).toHaveBeenCalledWith(null);
    });
  });

  describe("setSentryContext", () => {
    it("should set user metadata context with all fields", () => {
      const data = {
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
        provider: "google",
      };

      setSentryContext(data);

      expect(mockSetContext).toHaveBeenCalledTimes(1);
      expect(mockSetContext).toHaveBeenCalledWith("user_metadata", {
        onboarding_completed: true,
        onboarding_step: "COMPLETED",
        auth_provider: "google",
      });
    });

    it("should handle partial data", () => {
      const data = {
        onboardingCompleted: false,
      };

      setSentryContext(data);

      expect(mockSetContext).toHaveBeenCalledTimes(1);
      expect(mockSetContext).toHaveBeenCalledWith("user_metadata", {
        onboarding_completed: false,
        onboarding_step: undefined,
        auth_provider: undefined,
      });
    });

    it("should handle empty data object", () => {
      setSentryContext({});

      expect(mockSetContext).toHaveBeenCalledTimes(1);
      expect(mockSetContext).toHaveBeenCalledWith("user_metadata", {
        onboarding_completed: undefined,
        onboarding_step: undefined,
        auth_provider: undefined,
      });
    });

    it("should handle different onboarding steps", () => {
      const steps = [
        "NOT_STARTED",
        "WELCOME",
        "USER_PROFILE",
        "INITIAL_NET_WORTH",
        "PREFERENCES",
        "COMPLETED",
      ];

      steps.forEach((step) => {
        jest.clearAllMocks();

        setSentryContext({
          onboardingStep: step,
        });

        expect(mockSetContext).toHaveBeenCalledWith("user_metadata", {
          onboarding_completed: undefined,
          onboarding_step: step,
          auth_provider: undefined,
        });
      });
    });

    it("should handle different OAuth providers", () => {
      const providers = ["google", "github", "apple"];

      providers.forEach((provider) => {
        jest.clearAllMocks();

        setSentryContext({
          provider,
        });

        expect(mockSetContext).toHaveBeenCalledWith("user_metadata", {
          onboarding_completed: undefined,
          onboarding_step: undefined,
          auth_provider: provider,
        });
      });
    });

    it("should not expose PII in context", () => {
      const data = {
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
        provider: "google",
      };

      setSentryContext(data);

      const callArgs = mockSetContext.mock.calls[0][1];

      // Verify no PII fields
      expect(callArgs).not.toHaveProperty("email");
      expect(callArgs).not.toHaveProperty("name");
      expect(callArgs).not.toHaveProperty("userId");
      expect(callArgs).not.toHaveProperty("user_id");
    });
  });

  describe("clearSentryUser", () => {
    it("should clear user and context", () => {
      clearSentryUser();

      expect(mockSetUser).toHaveBeenCalledTimes(1);
      expect(mockSetUser).toHaveBeenCalledWith(null);

      expect(mockSetContext).toHaveBeenCalledTimes(1);
      expect(mockSetContext).toHaveBeenCalledWith("user_metadata", null);
    });

    it("should clear user and context in correct order", () => {
      clearSentryUser();

      // Verify both are called
      expect(mockSetUser).toHaveBeenCalled();
      expect(mockSetContext).toHaveBeenCalled();

      // Verify they're called with null
      expect(mockSetUser.mock.calls[0][0]).toBe(null);
      expect(mockSetContext.mock.calls[0][1]).toBe(null);
    });
  });

  describe("Integration Tests", () => {
    it("should set user and context together", () => {
      const session: Session = {
        user: {
          id: "integration-user",
          email: "user@example.com",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      const metadata = {
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
        provider: "github",
      };

      setSentryUser(session);
      setSentryContext(metadata);

      expect(mockSetUser).toHaveBeenCalledWith({
        id: "integration-user",
      });

      expect(mockSetContext).toHaveBeenCalledWith("user_metadata", {
        onboarding_completed: true,
        onboarding_step: "COMPLETED",
        auth_provider: "github",
      });
    });

    it("should handle sign out flow", () => {
      // Sign in
      const session: Session = {
        user: {
          id: "user-456",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);
      setSentryContext({
        onboardingCompleted: true,
      });

      jest.clearAllMocks();

      // Sign out
      clearSentryUser();

      expect(mockSetUser).toHaveBeenCalledWith(null);
      expect(mockSetContext).toHaveBeenCalledWith("user_metadata", null);
    });

    it("should handle onboarding progress updates", () => {
      const session: Session = {
        user: {
          id: "onboarding-user",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      // Step 1: Welcome
      setSentryContext({
        onboardingCompleted: false,
        onboardingStep: "WELCOME",
      });

      // Step 2: User Profile
      setSentryContext({
        onboardingCompleted: false,
        onboardingStep: "USER_PROFILE",
      });

      // Completed
      setSentryContext({
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
      });

      // Verify last call
      expect(mockSetContext).toHaveBeenLastCalledWith("user_metadata", {
        onboarding_completed: true,
        onboarding_step: "COMPLETED",
        auth_provider: undefined,
      });
    });
  });

  describe("Privacy & Security", () => {
    it("should NEVER send email to Sentry", () => {
      const session: Session = {
        user: {
          id: "privacy-test",
          email: "private@example.com",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      const userContext = mockSetUser.mock.calls[0][0];

      expect(userContext).toBeDefined();
      expect(userContext).not.toHaveProperty("email");
    });

    it("should NEVER send name to Sentry", () => {
      const session: Session = {
        user: {
          id: "privacy-test",
          name: "Private Name",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      const userContext = mockSetUser.mock.calls[0][0];

      expect(userContext).toBeDefined();
      expect(userContext).not.toHaveProperty("name");
    });

    it("should NEVER send image to Sentry", () => {
      const session: Session = {
        user: {
          id: "privacy-test",
          image: "https://avatar.com/user.jpg",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      const userContext = mockSetUser.mock.calls[0][0];

      expect(userContext).toBeDefined();
      expect(userContext).not.toHaveProperty("image");
    });

    it("should only include allowed fields in user context", () => {
      const session: Session = {
        user: {
          id: "allowed-only",
          email: "test@example.com",
          name: "Test User",
          image: "https://example.com/avatar.jpg",
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      setSentryUser(session);

      const userContext = mockSetUser.mock.calls[0][0];
      const keys = Object.keys(userContext || {});

      expect(keys).toEqual(["id"]);
      expect(keys).toHaveLength(1);
    });

    it("should only include non-PII metadata in context", () => {
      const data = {
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
        provider: "google",
      };

      setSentryContext(data);

      const context = mockSetContext.mock.calls[0][1];
      const keys = Object.keys(context || {});

      expect(keys).toEqual([
        "onboarding_completed",
        "onboarding_step",
        "auth_provider",
      ]);

      // Verify values are non-PII
      expect(context).toEqual({
        onboarding_completed: true,
        onboarding_step: "COMPLETED",
        auth_provider: "google",
      });
    });
  });
});
