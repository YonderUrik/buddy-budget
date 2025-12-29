import { PrismaClient, AuthProvider } from "@prisma/client";

/**
 * Type-safe mock of Prisma Client using plain Jest mocks
 */
export type MockPrismaClient = {
  [K in keyof PrismaClient]: PrismaClient[K] extends object
    ? {
        [M in keyof PrismaClient[K]]: jest.Mock;
      }
    : jest.Mock;
};

/**
 * Create a mock Prisma client instance
 */
function createMockPrismaClient(): MockPrismaClient {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
  } as any;
}

/**
 * Global Prisma mock instance
 */
export const prismaMock = createMockPrismaClient();

/**
 * Reset the Prisma mock - call this in beforeEach()
 */
export function resetPrismaMock() {
  // Reset all mocks in the user object
  Object.values(prismaMock.user).forEach((mock) => {
    if (typeof mock === "function" && "mockClear" in mock) {
      mock.mockClear();
    }
  });
}

/**
 * Factory function to create mock user data
 */
export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    firstName: "Test",
    lastName: "User",
    displayName: "Test",
    image: "https://example.com/avatar.jpg",
    provider: AuthProvider.GOOGLE,
    providerId: "google-123",
    onboardingCompleted: false,
    onboardingStep: "WELCOME",
    lastLoginAt: new Date("2024-01-01T00:00:00.000Z"),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    settings: {},
    financialGoals: null,
    cookieConsent: null,
    subscriptionTier: null,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    ...overrides,
  };
}
