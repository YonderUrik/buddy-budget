import { PrismaClient, AuthProvider } from "@prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "jest-mock-extended";

/**
 * Type-safe mock of Prisma Client
 */
export type MockPrismaClient = DeepMockProxy<PrismaClient>;

/**
 * Global Prisma mock instance
 */
export const prismaMock = mockDeep<PrismaClient>();

/**
 * Reset the Prisma mock - call this in beforeEach()
 */
export function resetPrismaMock() {
  mockReset(prismaMock);
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
