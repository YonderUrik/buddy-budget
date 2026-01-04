/**
 * @jest-environment node
 */

declare global {
  var __authConfig: any;
}

// Mock next-auth before importing
jest.mock("next-auth", () => {
  return jest.fn((config: any) => {
    // Store config for testing in global
    global.__authConfig = config;

    return {
      handlers: { GET: jest.fn(), POST: jest.fn() },
      signIn: jest.fn(),
      signOut: jest.fn(),
      auth: jest.fn(),
    };
  });
});

// Mock next-auth providers
jest.mock("next-auth/providers/google", () =>
  jest.fn((config) => ({ ...config, id: "google" })),
);
jest.mock("next-auth/providers/github", () =>
  jest.fn((config) => ({ ...config, id: "github" })),
);
jest.mock("next-auth/providers/apple", () =>
  jest.fn((config) => ({ ...config, id: "apple" })),
);

// Set up environment variables before importing
process.env.GOOGLE_CLIENT_ID = "test-google-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.GITHUB_CLIENT_ID = "test-github-id";
process.env.GITHUB_CLIENT_SECRET = "test-github-secret";
process.env.APPLE_CLIENT_ID = "test-apple-id";
process.env.APPLE_CLIENT_SECRET = "test-apple-secret";
process.env.NODE_ENV = "test";

// Import after mocks and env are set
import { OnboardingStep, AuthProvider, Currency } from "../auth";

describe("auth", () => {
  let authConfig: any;

  beforeAll(() => {
    authConfig = global.__authConfig;
  });

  describe("Enums", () => {
    it("should export OnboardingStep enum", () => {
      expect(OnboardingStep.NOT_STARTED).toBe("NOT_STARTED");
      expect(OnboardingStep.WELCOME).toBe("WELCOME");
      expect(OnboardingStep.USER_PROFILE).toBe("USER_PROFILE");
      expect(OnboardingStep.INITIAL_NET_WORTH).toBe("INITIAL_NET_WORTH");
      expect(OnboardingStep.PREFERENCES).toBe("PREFERENCES");
      expect(OnboardingStep.COMPLETED).toBe("COMPLETED");
    });

    it("should export AuthProvider enum", () => {
      expect(AuthProvider.GOOGLE).toBe("GOOGLE");
      expect(AuthProvider.GITHUB).toBe("GITHUB");
      expect(AuthProvider.APPLE).toBe("APPLE");
    });

    it("should export Currency enum", () => {
      expect(Currency.USD).toBe("USD");
      expect(Currency.EUR).toBe("EUR");
      expect(Currency.GBP).toBe("GBP");
      expect(Currency.JPY).toBe("JPY");
      expect(Currency.CAD).toBe("CAD");
      expect(Currency.AUD).toBe("AUD");
      expect(Currency.CHF).toBe("CHF");
      expect(Currency.CNY).toBe("CNY");
      expect(Currency.INR).toBe("INR");
      expect(Currency.BRL).toBe("BRL");
      expect(Currency.MXN).toBe("MXN");
      expect(Currency.KRW).toBe("KRW");
      expect(Currency.SGD).toBe("SGD");
      expect(Currency.HKD).toBe("HKD");
      expect(Currency.NZD).toBe("NZD");
    });
  });

  describe("NextAuth Configuration", () => {
    it("should configure JWT strategy", () => {
      expect(authConfig.session.strategy).toBe("jwt");
      expect(authConfig.session.maxAge).toBe(30 * 24 * 60 * 60);
    });

    it("should configure custom pages", () => {
      expect(authConfig.pages.signIn).toBe("/signin");
      expect(authConfig.pages.error).toBe("/signin");
      expect(authConfig.pages.newUser).toBe("/onboarding/welcome");
    });

    it("should configure three OAuth providers", () => {
      expect(authConfig.providers).toHaveLength(3);
      expect(authConfig.providers[0]).toHaveProperty("id");
      expect(authConfig.providers[1]).toHaveProperty("id");
      expect(authConfig.providers[2]).toHaveProperty("id");
    });

    it("should configure debug mode", () => {
      // Debug is set based on NODE_ENV at module import time
      expect(authConfig).toHaveProperty("debug");
      expect(typeof authConfig.debug).toBe("boolean");
    });
  });

  describe("signIn callback", () => {
    it("should allow sign in and store provider info", async () => {
      const callback = authConfig.callbacks.signIn;
      const user = { id: "123", email: "test@example.com" };
      const account = { provider: "google" };

      const result = await callback({ user, account });

      expect(result).toBe(true);
      expect(user.provider).toBe("google");
    });

    it("should allow sign in without account", async () => {
      const callback = authConfig.callbacks.signIn;
      const user = { id: "123", email: "test@example.com" };

      const result = await callback({ user, account: null });

      expect(result).toBe(true);
    });
  });

  describe("jwt callback", () => {
    it("should set user data on initial sign in", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const token = {};
      const user = {
        id: "123",
        email: "test@example.com",
        name: "Test User",
        image: "http://example.com/avatar.jpg",
      };

      const result = await jwtCallback({ token, user });

      expect(result.id).toBe("123");
      expect(result.email).toBe("test@example.com");
      expect(result.name).toBe("Test User");
      expect(result.picture).toBe("http://example.com/avatar.jpg");
    });

    it("should fetch user status from API on sign in", async () => {
      const jwtCallback = authConfig.callbacks.jwt;

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              exists: true,
              onboardingCompleted: true,
              onboardingStep: "COMPLETED",
              provider: "GOOGLE",
            }),
        }),
      ) as any;

      const token = {};
      const user = {
        id: "123",
        email: "existing@example.com",
        name: "Existing User",
      };

      const result = await jwtCallback({ token, user });

      expect(result.onboardingCompleted).toBe(true);
      expect(result.onboardingStep).toBe("COMPLETED");
      expect(result.provider).toBe("GOOGLE");
    });

    it("should use defaults for new users from API", async () => {
      const jwtCallback = authConfig.callbacks.jwt;

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              exists: false,
            }),
        }),
      ) as any;

      const token = {};
      const user = {
        id: "123",
        email: "new@example.com",
        name: "New User",
        provider: "GITHUB",
      };

      const result = await jwtCallback({ token, user });

      expect(result.onboardingCompleted).toBe(false);
      expect(result.onboardingStep).toBe("NOT_STARTED");
      expect(result.provider).toBe("GITHUB");
    });

    it("should handle API failure gracefully", async () => {
      const jwtCallback = authConfig.callbacks.jwt;

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
        }),
      ) as any;

      const token = {};
      const user = {
        id: "123",
        email: "test@example.com",
        name: "Test User",
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
        provider: "APPLE",
      };

      const result = await jwtCallback({ token, user });

      expect(result.onboardingCompleted).toBe(true);
      expect(result.onboardingStep).toBe("COMPLETED");
      expect(result.provider).toBe("APPLE");
    });

    it("should handle API fetch error", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      global.fetch = jest.fn(() =>
        Promise.reject(new Error("Network error")),
      ) as any;

      const token = {};
      const user = {
        id: "123",
        email: "test@example.com",
        name: "Test User",
      };

      const result = await jwtCallback({ token, user });

      expect(result.onboardingCompleted).toBe(false);
      expect(result.onboardingStep).toBe("NOT_STARTED");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should store account info for database sync", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const token = {};
      const user = { id: "123", email: "test@example.com" };
      const account = {
        provider: "google",
        providerAccountId: "google-123",
      };

      const result = await jwtCallback({ token, user, account });

      expect(result.accountProvider).toBe("google");
      expect(result.accountProviderId).toBe("google-123");
    });

    it("should update token on session update", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const token = {
        onboardingCompleted: false,
        onboardingStep: "WELCOME",
      };
      const session = {
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
      };

      const result = await jwtCallback({
        token,
        trigger: "update",
        session,
      });

      expect(result.onboardingCompleted).toBe(true);
      expect(result.onboardingStep).toBe("COMPLETED");
    });

    it("should handle partial session updates", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const token = {
        onboardingCompleted: false,
        onboardingStep: "WELCOME",
      };
      const session = {
        onboardingStep: "USER_PROFILE",
      };

      const result = await jwtCallback({
        token,
        trigger: "update",
        session,
      });

      expect(result.onboardingCompleted).toBe(false);
      expect(result.onboardingStep).toBe("USER_PROFILE");
    });

    it("should use defaults when no email provided", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const token = {};
      const user = {
        id: "123",
        name: "Test User",
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
        provider: "GOOGLE",
      };

      const result = await jwtCallback({ token, user });

      expect(result.onboardingCompleted).toBe(true);
      expect(result.onboardingStep).toBe("COMPLETED");
      expect(result.provider).toBe("GOOGLE");
    });

    it("should construct correct API URL with HTTPS", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const originalUrl = process.env.NEXTAUTH_URL;

      process.env.NEXTAUTH_URL = "https://example.com";

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ exists: false }),
        }),
      ) as any;

      const token = {};
      const user = { id: "123", email: "test@example.com" };

      await jwtCallback({ token, user });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com/api/user/status",
        expect.any(Object),
      );

      process.env.NEXTAUTH_URL = originalUrl;
    });

    it("should construct correct API URL with HTTP", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const originalUrl = process.env.NEXTAUTH_URL;

      process.env.NEXTAUTH_URL = "http://localhost:3000";

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ exists: false }),
        }),
      ) as any;

      const token = {};
      const user = { id: "123", email: "test@example.com" };

      await jwtCallback({ token, user });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/user/status",
        expect.any(Object),
      );

      process.env.NEXTAUTH_URL = originalUrl;
    });

    it("should use default localhost when NEXTAUTH_URL not set", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const originalUrl = process.env.NEXTAUTH_URL;

      delete process.env.NEXTAUTH_URL;

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ exists: false }),
        }),
      ) as any;

      const token = {};
      const user = { id: "123", email: "test@example.com" };

      await jwtCallback({ token, user });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/user/status",
        expect.any(Object),
      );

      process.env.NEXTAUTH_URL = originalUrl;
    });

    it("should skip API call in browser (window defined)", async () => {
      const jwtCallback = authConfig.callbacks.jwt;
      const originalWindow = (global as any).window;

      (global as any).window = {};

      const token = {};
      const user = {
        id: "123",
        email: "test@example.com",
        onboardingCompleted: true,
      };

      // Don't spy on fetch since it won't be called
      const result = await jwtCallback({ token, user });

      expect(result.onboardingCompleted).toBe(true);

      // Restore
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        (global as any).window = originalWindow;
      }
    });
  });

  describe("session callback", () => {
    it("should populate session from token", async () => {
      const sessionCallback = authConfig.callbacks.session;
      const session = { user: {} };
      const token = {
        id: "123",
        email: "test@example.com",
        name: "Test User",
        picture: "http://example.com/avatar.jpg",
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
        provider: "GOOGLE",
        accountProvider: "google",
        accountProviderId: "google-123",
      };

      const result = await sessionCallback({ session, token });

      expect(result.user.id).toBe("123");
      expect(result.user.email).toBe("test@example.com");
      expect(result.user.name).toBe("Test User");
      expect(result.user.image).toBe("http://example.com/avatar.jpg");
      expect(result.user.onboardingCompleted).toBe(true);
      expect(result.user.onboardingStep).toBe("COMPLETED");
      expect(result.user.provider).toBe("GOOGLE");
      expect(result.user.accountProvider).toBe("google");
      expect(result.user.accountProviderId).toBe("google-123");
    });

    it("should handle null values in token", async () => {
      const sessionCallback = authConfig.callbacks.session;
      const session = { user: {} };
      const token = {
        id: "123",
        email: "test@example.com",
        name: null,
        picture: null,
        onboardingCompleted: false,
        onboardingStep: "NOT_STARTED",
        provider: null,
      };

      const result = await sessionCallback({ session, token });

      expect(result.user.name).toBeNull();
      expect(result.user.image).toBeNull();
      expect(result.user.provider).toBeNull();
    });
  });

  describe("exports", () => {
    it("should export handlers, signIn, signOut, and auth", () => {
      const { handlers, signIn, signOut, auth } = require("./auth");

      expect(handlers).toBeDefined();
      expect(signIn).toBeDefined();
      expect(signOut).toBeDefined();
      expect(auth).toBeDefined();
    });
  });
});
