// Mock next-auth and providers before any imports
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

// Mock Prisma before imports
import { prismaMock } from "@/app/api/__tests__/mocks/prisma.mock";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: prismaMock,
  connectDB: jest.fn(),
  disconnectDB: jest.fn(),
}));

// Mock auth
jest.mock("@/lib/auth");

// eslint-disable-next-line import/order
import { PATCH } from "./route";

import { auth } from "@/lib/auth";
import { RequestBuilder } from "@/app/api/__tests__/utils/requestBuilder";
import {
  expectJsonResponse,
  expectErrorResponse,
} from "@/app/api/__tests__/utils/assertions";
import {
  mockAuthenticatedSession,
  mockUnauthenticatedSession,
  createMockSession,
} from "@/app/api/__tests__/mocks/auth.mock";
import {
  resetPrismaMock,
  createMockUser,
} from "@/app/api/__tests__/mocks/prisma.mock";

const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe("PATCH /api/user/onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrismaMock();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockAuth.mockResolvedValue(mockUnauthenticatedSession);

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ onboardingStep: "USER_PROFILE" })
        .build();

      const response = await PATCH(request);

      await expectErrorResponse(response, 401, "Unauthorized");
    });

    it("should return 401 when session has no email", async () => {
      const sessionWithoutEmail = createMockSession({ email: undefined });

      mockAuth.mockResolvedValue(sessionWithoutEmail);

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ onboardingStep: "USER_PROFILE" })
        .build();

      const response = await PATCH(request);

      await expectErrorResponse(response, 401, "Unauthorized");
    });
  });

  describe("Successful Updates", () => {
    const mockUser = createMockUser();

    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(mockUser);
    });

    it("should update onboarding step", async () => {
      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ onboardingStep: "USER_PROFILE" })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          onboardingStep: "USER_PROFILE",
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("should update onboarding completion status", async () => {
      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ onboardingCompleted: true })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          onboardingCompleted: true,
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("should update user profile fields", async () => {
      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({
          firstName: "John",
          lastName: "Doe",
          displayName: "JD",
        })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          displayName: "JD",
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("should update financial goals array", async () => {
      const financialGoals = [
        { type: "SAVINGS", amount: 10000, deadline: "2025-12-31" },
      ];

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ financialGoals })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          financialGoals,
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("should return success with updated user", async () => {
      const updatedUser = { ...mockUser, firstName: "Updated" };

      prismaMock.user.update.mockResolvedValue(updatedUser);

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ firstName: "Updated" })
        .build();

      const response = await PATCH(request);
      const data = await expectJsonResponse(response, 200, { success: true });

      expect(data.user).toMatchObject({
        firstName: "Updated",
        email: "test@example.com",
        id: "test-user-id",
      });
    });
  });

  describe("Settings Merging", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
    });

    it("should merge new settings with existing settings", async () => {
      const existingUser = createMockUser({
        settings: {
          dateFormat: "MM/DD/YYYY",
          currency: "USD",
        },
      });

      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.user.update.mockResolvedValue(existingUser);

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({
          settings: {
            notifications: { email: true },
          },
        })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          settings: {
            dateFormat: "MM/DD/YYYY",
            currency: "USD",
            notifications: { email: true },
          },
        }),
      });
    });

    it("should handle null existing settings", async () => {
      const existingUser = createMockUser({ settings: null });

      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.user.update.mockResolvedValue(existingUser);

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({
          settings: {
            currency: "EUR",
          },
        })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          settings: {
            currency: "EUR",
          },
        }),
      });
    });

    it("should handle non-object existing settings", async () => {
      const existingUser = createMockUser({ settings: "not-an-object" as any });

      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.user.update.mockResolvedValue(existingUser);

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({
          settings: {
            currency: "GBP",
          },
        })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          settings: {
            currency: "GBP",
          },
        }),
      });
    });
  });

  describe("Financial Goals", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
      prismaMock.user.findUnique.mockResolvedValue(createMockUser());
      prismaMock.user.update.mockResolvedValue(createMockUser());
    });

    it("should handle empty financialGoals array", async () => {
      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ financialGoals: [] })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          financialGoals: [],
        }),
      });
    });

    it("should handle null financialGoals", async () => {
      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ financialGoals: null })
        .build();

      await PATCH(request);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          financialGoals: null,
        }),
      });
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
    });

    it("should return 500 when update fails", async () => {
      prismaMock.user.findUnique.mockResolvedValue(createMockUser());
      prismaMock.user.update.mockRejectedValue(new Error("Database error"));

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ firstName: "Test" })
        .build();

      const response = await PATCH(request);

      await expectErrorResponse(response, 500, "Failed to update onboarding");
    });

    it("should return 500 when user findUnique fails", async () => {
      prismaMock.user.findUnique.mockRejectedValue(
        new Error("DB connection error"),
      );

      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ firstName: "Test" })
        .build();

      const response = await PATCH(request);

      await expectErrorResponse(response, 500, "Failed to update onboarding");
    });
  });

  describe("Request Body Validation", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
      prismaMock.user.findUnique.mockResolvedValue(createMockUser());
      prismaMock.user.update.mockResolvedValue(createMockUser());
    });

    it("should handle partial updates", async () => {
      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({ firstName: "OnlyFirst" })
        .build();

      const response = await PATCH(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it("should handle empty request body", async () => {
      const request = new RequestBuilder("/api/user/onboarding")
        .setMethod("PATCH")
        .body({})
        .build();

      const response = await PATCH(request);

      expect(response.status).toBe(200);
    });
  });
});
