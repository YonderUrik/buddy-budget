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

import { NextRequest } from "next/server";
import { POST } from "./route";
import { auth } from "@/lib/auth";
import { AuthProvider as PrismaAuthProvider } from "@prisma/client";
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

describe("POST /api/auth/sync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrismaMock();
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      mockAuth.mockResolvedValue(mockUnauthenticatedSession);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "google" })
        .build();

      const response = await POST(request);

      await expectErrorResponse(response, 401, "Unauthorized");
    });

    it("should return 401 when session has no email", async () => {
      const sessionWithoutEmail = createMockSession({ email: undefined });
      mockAuth.mockResolvedValue(sessionWithoutEmail);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "google" })
        .build();

      const response = await POST(request);

      await expectErrorResponse(response, 401, "Unauthorized");
    });
  });

  describe("Existing User", () => {
    const existingUser = createMockUser({
      email: "test@example.com",
      name: "Test User",
      firstName: "Test",
      lastName: "User",
      provider: PrismaAuthProvider.GOOGLE,
    });

    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
      prismaMock.user.findUnique.mockResolvedValue(existingUser);
      prismaMock.user.update.mockResolvedValue(existingUser);
    });

    it("should update existing user and return user data", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "google", accountProviderId: "google-123" })
        .build();

      const response = await POST(request);
      const data = await expectJsonResponse(response, 200, { success: true });

      expect(data.user).toBeDefined();
      expect(data.isNew).toBeUndefined();
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it("should update lastLoginAt timestamp", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data.lastLoginAt).toBeInstanceOf(Date);
    });

    it("should update name when changed from provider", async () => {
      const sessionWithNewName = createMockSession({ name: "New Name" });
      mockAuth.mockResolvedValue(sessionWithNewName);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data).toMatchObject({
        name: "New Name",
      });
    });

    it("should update image when changed from provider", async () => {
      const sessionWithNewImage = createMockSession({
        image: "https://new-image.com/avatar.jpg",
      });
      mockAuth.mockResolvedValue(sessionWithNewImage);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data).toMatchObject({
        image: "https://new-image.com/avatar.jpg",
      });
    });

    it("should not update name if unchanged", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      // Name should not be updated when it's the same
      expect(updateCall.data.name).toBeUndefined();
    });

    it("should set firstName/lastName only if not already set", async () => {
      const userWithoutNames = createMockUser({
        firstName: null,
        lastName: null,
      });
      prismaMock.user.findUnique.mockResolvedValue(userWithoutNames);

      const sessionWithName = createMockSession({ name: "John Doe" });
      mockAuth.mockResolvedValue(sessionWithName);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data).toMatchObject({
        firstName: "John",
        lastName: "Doe",
      });
    });

    it("should not overwrite existing firstName/lastName", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      // firstName and lastName should not be in update data when already set
      expect(updateCall.data.firstName).toBeUndefined();
      expect(updateCall.data.lastName).toBeUndefined();
    });

    it("should set provider if not already set", async () => {
      const userWithoutProvider = createMockUser({ provider: null });
      prismaMock.user.findUnique.mockResolvedValue(userWithoutProvider);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "github", accountProviderId: "github-456" })
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data).toMatchObject({
        provider: PrismaAuthProvider.GITHUB,
        providerId: "github-456",
      });
    });

    it("should not overwrite existing provider", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "apple", accountProviderId: "apple-789" })
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      // Provider and providerId should not be in update data when already set
      expect(updateCall.data.provider).toBeUndefined();
      expect(updateCall.data.providerId).toBeUndefined();
    });

    it("should not set provider for invalid provider mapping when user has no provider", async () => {
      const userWithoutProvider = createMockUser({ provider: null });
      prismaMock.user.findUnique.mockResolvedValue(userWithoutProvider);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "invalid-provider", accountProviderId: "invalid-123" })
        .build();

      await POST(request);

      const updateCall = prismaMock.user.update.mock.calls[0][0];
      // Invalid provider should not set provider or providerId
      expect(updateCall.data.provider).toBeUndefined();
      expect(updateCall.data.providerId).toBeUndefined();
    });
  });

  describe("New User", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
      prismaMock.user.findUnique.mockResolvedValue(null);
    });

    it("should create new user with correct data", async () => {
      const newUser = createMockUser();
      prismaMock.user.create.mockResolvedValue(newUser);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "google", accountProviderId: "google-123" })
        .build();

      const response = await POST(request);
      const data = await expectJsonResponse(response, 200, { success: true, isNew: true });

      expect(data.user).toBeDefined();
      expect(prismaMock.user.create).toHaveBeenCalled();
    });

    it("should set default onboarding step to WELCOME", async () => {
      const newUser = createMockUser();
      prismaMock.user.create.mockResolvedValue(newUser);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "google" })
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          onboardingStep: "WELCOME",
        }),
        select: expect.any(Object),
      });
    });

    it("should set onboardingCompleted to false", async () => {
      const newUser = createMockUser();
      prismaMock.user.create.mockResolvedValue(newUser);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          onboardingCompleted: false,
        }),
        select: expect.any(Object),
      });
    });

    it("should extract firstName/lastName from name", async () => {
      const sessionWithName = createMockSession({ name: "Alice Johnson" });
      mockAuth.mockResolvedValue(sessionWithName);

      const newUser = createMockUser();
      prismaMock.user.create.mockResolvedValue(newUser);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: "Alice",
          lastName: "Johnson",
        }),
        select: expect.any(Object),
      });
    });

    it("should set displayName to firstName if available", async () => {
      const sessionWithName = createMockSession({ name: "Bob Smith" });
      mockAuth.mockResolvedValue(sessionWithName);

      const newUser = createMockUser();
      prismaMock.user.create.mockResolvedValue(newUser);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          displayName: "Bob",
        }),
        select: expect.any(Object),
      });
    });

    it("should handle single-word names correctly", async () => {
      const sessionWithName = createMockSession({ name: "Madonna" });
      mockAuth.mockResolvedValue(sessionWithName);

      const newUser = createMockUser();
      prismaMock.user.create.mockResolvedValue(newUser);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: "Madonna",
          lastName: null,
        }),
        select: expect.any(Object),
      });
    });
  });

  describe("Name Extraction Edge Cases", () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(createMockUser());
    });

    it("should handle null/undefined name", async () => {
      const sessionWithoutName = createMockSession({ name: null });
      mockAuth.mockResolvedValue(sessionWithoutName);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: null,
          lastName: null,
        }),
        select: expect.any(Object),
      });
    });

    it("should handle empty string name", async () => {
      const sessionWithEmptyName = createMockSession({ name: "" });
      mockAuth.mockResolvedValue(sessionWithEmptyName);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: null,
          lastName: null,
        }),
        select: expect.any(Object),
      });
    });

    it("should handle multi-part last names", async () => {
      const sessionWithName = createMockSession({ name: "John von Neumann" });
      mockAuth.mockResolvedValue(sessionWithName);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: "John",
          lastName: "von Neumann",
        }),
        select: expect.any(Object),
      });
    });

    it("should handle extra whitespace", async () => {
      const sessionWithName = createMockSession({ name: "  Jane   Doe  " });
      mockAuth.mockResolvedValue(sessionWithName);

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: "Jane",
          lastName: "Doe",
        }),
        select: expect.any(Object),
      });
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
    });

    it("should return 500 when database query fails", async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error("DB Error"));

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      const response = await POST(request);

      await expectErrorResponse(response, 500, "Failed to sync user data");
    });

    it("should return 500 when user creation fails", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockRejectedValue(new Error("Create failed"));

      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      const response = await POST(request);

      await expectErrorResponse(response, 500, "Failed to sync user data");
    });
  });

  describe("Request Body Validation", () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(mockAuthenticatedSession);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue(createMockUser());
    });

    it("should handle missing accountProvider", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({})
        .build();

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: null,
        }),
        select: expect.any(Object),
      });
    });

    it("should handle invalid provider mapping", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "invalid-provider", accountProviderId: "123" })
        .build();

      const response = await POST(request);

      expect(response.status).toBe(200);
      const createCall = prismaMock.user.create.mock.calls[0][0];
      // Invalid provider should result in undefined (which becomes null in DB)
      expect(createCall.data.provider).toBeUndefined();
    });

    it("should map google provider correctly", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "google", accountProviderId: "google-123" })
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: PrismaAuthProvider.GOOGLE,
          providerId: "google-123",
        }),
        select: expect.any(Object),
      });
    });

    it("should map github provider correctly", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "github", accountProviderId: "github-456" })
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: PrismaAuthProvider.GITHUB,
          providerId: "github-456",
        }),
        select: expect.any(Object),
      });
    });

    it("should map apple provider correctly", async () => {
      const request = new RequestBuilder("/api/auth/sync")
        .setMethod("POST")
        .body({ accountProvider: "apple", accountProviderId: "apple-789" })
        .build();

      await POST(request);

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: PrismaAuthProvider.APPLE,
          providerId: "apple-789",
        }),
        select: expect.any(Object),
      });
    });
  });
});
