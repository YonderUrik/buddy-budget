// Mock next-auth and providers before imports
jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    handlers: { GET: jest.fn(), POST: jest.fn() },
    auth: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  })),
}));

jest.mock("next-auth/providers/google", () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

jest.mock("next-auth/providers/github", () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

jest.mock("next-auth/providers/apple", () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

import { GET, POST } from "./route";

/**
 * Integration tests for NextAuth route handlers
 *
 * Note: These tests verify that the NextAuth handlers are properly exported.
 * The actual authentication logic is handled by NextAuth.js library.
 */
describe("NextAuth Route Handlers", () => {
  it("should export GET handler", () => {
    expect(GET).toBeDefined();
    expect(typeof GET).toBe("function");
  });

  it("should export POST handler", () => {
    expect(POST).toBeDefined();
    expect(typeof POST).toBe("function");
  });
});
