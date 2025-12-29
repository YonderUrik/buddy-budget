// Mock Prisma before imports
import { AuthProvider as PrismaAuthProvider } from "@prisma/client";

import { prismaMock } from "@/app/api/__tests__/mocks/prisma.mock";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  prisma: prismaMock,
  connectDB: jest.fn(),
  disconnectDB: jest.fn(),
}));

// eslint-disable-next-line import/order
import { POST } from "./route";
import { RequestBuilder } from "@/app/api/__tests__/utils/requestBuilder";
import {
  expectJsonResponse,
  expectErrorResponse,
} from "@/app/api/__tests__/utils/assertions";
import {
  resetPrismaMock,
  createMockUser,
} from "@/app/api/__tests__/mocks/prisma.mock";

describe("POST /api/user/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrismaMock();
  });

  describe("Request Validation", () => {
    it("should return 400 when email is missing", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({})
        .build();

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Email is required");
    });

    it("should return 400 when email is null", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: null })
        .build();

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Email is required");
    });

    it("should return 400 when email is empty string", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "" })
        .build();

      const response = await POST(request);

      await expectErrorResponse(response, 400, "Email is required");
    });
  });

  describe("Existing User", () => {
    const existingUser = createMockUser({
      id: "user-123",
      email: "test@example.com",
      onboardingCompleted: true,
      onboardingStep: "COMPLETED",
      provider: PrismaAuthProvider.GOOGLE,
    });

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(existingUser);
    });

    it("should return user status when user exists", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "test@example.com" })
        .build();

      const response = await POST(request);
      const data = await expectJsonResponse(response, 200, {
        exists: true,
      });

      expect(data.onboardingCompleted).toBe(true);
      expect(data.onboardingStep).toBe("COMPLETED");
      expect(data.provider).toBe(PrismaAuthProvider.GOOGLE);
    });

    it("should query database with correct email", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "user@test.com" })
        .build();

      await POST(request);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "user@test.com" },
        select: {
          id: true,
          onboardingCompleted: true,
          onboardingStep: true,
          provider: true,
        },
      });
    });

    it("should return correct status for user with incomplete onboarding", async () => {
      const userWithIncompleteOnboarding = createMockUser({
        onboardingCompleted: false,
        onboardingStep: "USER_PROFILE",
        provider: PrismaAuthProvider.GITHUB,
      });

      prismaMock.user.findUnique.mockResolvedValue(
        userWithIncompleteOnboarding,
      );

      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "test@example.com" })
        .build();

      const response = await POST(request);
      const data = await expectJsonResponse(response, 200, {
        exists: true,
      });

      expect(data.onboardingCompleted).toBe(false);
      expect(data.onboardingStep).toBe("USER_PROFILE");
      expect(data.provider).toBe(PrismaAuthProvider.GITHUB);
    });

    it("should return correct status for user with null provider", async () => {
      const userWithNullProvider = createMockUser({
        onboardingCompleted: true,
        onboardingStep: "COMPLETED",
        provider: null,
      });

      prismaMock.user.findUnique.mockResolvedValue(userWithNullProvider);

      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "test@example.com" })
        .build();

      const response = await POST(request);
      const data = await expectJsonResponse(response, 200, {
        exists: true,
      });

      expect(data.provider).toBeNull();
    });
  });

  describe("Non-Existing User", () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(null);
    });

    it("should return exists: false when user not found", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "nonexistent@example.com" })
        .build();

      const response = await POST(request);
      const data = await expectJsonResponse(response, 200, {
        exists: false,
      });

      expect(data.onboardingCompleted).toBeUndefined();
      expect(data.onboardingStep).toBeUndefined();
      expect(data.provider).toBeUndefined();
    });

    it("should query database even for non-existent users", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "new@user.com" })
        .build();

      await POST(request);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "new@user.com" },
        select: {
          id: true,
          onboardingCompleted: true,
          onboardingStep: true,
          provider: true,
        },
      });
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when database query fails", async () => {
      prismaMock.user.findUnique.mockRejectedValue(
        new Error("Database connection error"),
      );

      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "test@example.com" })
        .build();

      const response = await POST(request);

      await expectErrorResponse(response, 500, "Failed to check user status");
    });

    it("should log error when database query fails", async () => {
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      prismaMock.user.findUnique.mockRejectedValue(new Error("DB Error"));

      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "test@example.com" })
        .build();

      await POST(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking user status:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Onboarding Steps", () => {
    it.each([
      ["NOT_STARTED", false],
      ["WELCOME", false],
      ["USER_PROFILE", false],
      ["INITIAL_NET_WORTH", false],
      ["PREFERENCES", false],
      ["COMPLETED", true],
    ])(
      "should handle onboarding step %s with completed=%s",
      async (step, completed) => {
        const user = createMockUser({
          onboardingStep: step,
          onboardingCompleted: completed,
        });

        prismaMock.user.findUnique.mockResolvedValue(user);

        const request = new RequestBuilder("/api/user/status")
          .setMethod("POST")
          .body({ email: "test@example.com" })
          .build();

        const response = await POST(request);
        const data = await expectJsonResponse(response, 200, {
          exists: true,
        });

        expect(data.onboardingStep).toBe(step);
        expect(data.onboardingCompleted).toBe(completed);
      },
    );
  });

  describe("Auth Providers", () => {
    it.each([
      PrismaAuthProvider.GOOGLE,
      PrismaAuthProvider.GITHUB,
      PrismaAuthProvider.APPLE,
    ])("should handle %s provider", async (provider) => {
      const user = createMockUser({
        provider,
      });

      prismaMock.user.findUnique.mockResolvedValue(user);

      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "test@example.com" })
        .build();

      const response = await POST(request);
      const data = await expectJsonResponse(response, 200, {
        exists: true,
      });

      expect(data.provider).toBe(provider);
    });
  });

  describe("Email Formats", () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(null);
    });

    it("should handle email with plus sign", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "user+tag@example.com" })
        .build();

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "user+tag@example.com" },
        select: expect.any(Object),
      });
    });

    it("should handle email with subdomain", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "user@mail.example.com" })
        .build();

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "user@mail.example.com" },
        select: expect.any(Object),
      });
    });

    it("should handle email with numbers", async () => {
      const request = new RequestBuilder("/api/user/status")
        .setMethod("POST")
        .body({ email: "user123@example.com" })
        .build();

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: "user123@example.com" },
        select: expect.any(Object),
      });
    });
  });
});
