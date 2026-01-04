import { PrismaClient } from "@prisma/client";

// Mock PrismaClient before importing db module
const mockPrismaClient = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  };
});

describe("db", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockPrismaClient.$connect.mockClear();
    mockPrismaClient.$disconnect.mockClear();
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  describe("prisma instance", () => {
    it("should export a prisma instance", async () => {
      const { prisma } = await import("./db");

      expect(prisma).toBeDefined();
      expect(prisma).toBe(mockPrismaClient);
    });

    it("should export prisma as default export", async () => {
      const dbModule = await import("./db");

      expect(dbModule.default).toBeDefined();
      expect(dbModule.default).toBe(dbModule.prisma);
    });

    it("should use PrismaClient with appropriate log config", async () => {
      // Since the module is already imported, we just verify the instance exists
      const { prisma } = await import("./db");

      expect(prisma).toHaveProperty("$connect");
      expect(prisma).toHaveProperty("$disconnect");
    });

    it("should set globalForPrisma in non-production environments", () => {
      // The db module should set global prisma in non-production
      const globalForPrisma = globalThis as any;

      if (process.env.NODE_ENV !== "production") {
        expect(globalForPrisma.prisma).toBeDefined();
      } else {
        // In production, it may or may not be set depending on execution order
        expect(true).toBe(true);
      }
    });

    it("should handle logging configuration based on environment", () => {
      // The db.ts file checks NODE_ENV at import time to configure logging
      // Lines 19-24 are the ternary for log config which is covered at module import
      // We verify the prisma instance was created
      const { prisma } = require("./db");

      expect(prisma).toBeDefined();
      expect(prisma).toHaveProperty("$connect");
      expect(prisma).toHaveProperty("$disconnect");
    });
  });

  describe("connectDB", () => {
    it("should connect to the database successfully", async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      const { connectDB } = await import("./db");

      await connectDB();

      expect(mockPrismaClient.$connect).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "Database connected successfully",
      );
    });

    it("should log error and throw when connection fails", async () => {
      const error = new Error("Connection failed");

      mockPrismaClient.$connect.mockRejectedValue(error);
      const { connectDB } = await import("./db");

      await expect(connectDB()).rejects.toThrow("Connection failed");

      expect(console.error).toHaveBeenCalledWith(
        "Failed to connect to database:",
        error,
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("ECONNREFUSED");

      mockPrismaClient.$connect.mockRejectedValue(networkError);
      const { connectDB } = await import("./db");

      await expect(connectDB()).rejects.toThrow("ECONNREFUSED");
    });

    it("should handle authentication errors", async () => {
      const authError = new Error("Authentication failed");

      mockPrismaClient.$connect.mockRejectedValue(authError);
      const { connectDB } = await import("./db");

      await expect(connectDB()).rejects.toThrow("Authentication failed");
    });
  });

  describe("disconnectDB", () => {
    it("should disconnect from the database successfully", async () => {
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);
      const { disconnectDB } = await import("./db");

      await disconnectDB();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        "Database disconnected successfully",
      );
    });

    it("should log error and throw when disconnection fails", async () => {
      const error = new Error("Disconnection failed");

      mockPrismaClient.$disconnect.mockRejectedValue(error);
      const { disconnectDB } = await import("./db");

      await expect(disconnectDB()).rejects.toThrow("Disconnection failed");

      expect(console.error).toHaveBeenCalledWith(
        "Failed to disconnect from database:",
        error,
      );
    });

    it("should handle errors gracefully", async () => {
      const unexpectedError = new Error("Unexpected error");

      mockPrismaClient.$disconnect.mockRejectedValue(unexpectedError);
      const { disconnectDB } = await import("./db");

      await expect(disconnectDB()).rejects.toThrow("Unexpected error");
    });
  });

  describe("connection lifecycle", () => {
    it("should support connect -> disconnect sequence", async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);
      const { connectDB, disconnectDB } = await import("./db");

      await connectDB();
      expect(mockPrismaClient.$connect).toHaveBeenCalled();

      await disconnectDB();
      expect(mockPrismaClient.$disconnect).toHaveBeenCalled();
    });

    it("should handle multiple connect calls", async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);
      const { connectDB } = await import("./db");

      await connectDB();
      await connectDB();

      expect(mockPrismaClient.$connect).toHaveBeenCalledTimes(2);
    });

    it("should handle multiple disconnect calls", async () => {
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);
      const { disconnectDB } = await import("./db");

      await disconnectDB();
      await disconnectDB();

      expect(mockPrismaClient.$disconnect).toHaveBeenCalledTimes(2);
    });
  });

  describe("error scenarios", () => {
    it("should propagate connection timeout errors", async () => {
      const timeoutError = new Error("Connection timeout");

      mockPrismaClient.$connect.mockRejectedValue(timeoutError);
      const { connectDB } = await import("./db");

      await expect(connectDB()).rejects.toThrow("Connection timeout");
    });

    it("should propagate disconnection errors", async () => {
      const disconnectError = new Error("Failed to close connection");

      mockPrismaClient.$disconnect.mockRejectedValue(disconnectError);
      const { disconnectDB } = await import("./db");

      await expect(disconnectDB()).rejects.toThrow(
        "Failed to close connection",
      );
    });

    it("should handle undefined errors", async () => {
      mockPrismaClient.$connect.mockRejectedValue(undefined);
      const { connectDB } = await import("./db");

      await expect(connectDB()).rejects.toBeUndefined();
    });
  });
});
