import { GET } from "./route";

import { getStockDetails } from "@/components/yahoo-finance/functions";
import { RequestBuilder } from "@/app/api/__tests__/utils/requestBuilder";
import {
  expectJsonResponse,
  expectErrorResponse,
} from "@/app/api/__tests__/utils/assertions";
import { mockStockDetails } from "@/app/api/__tests__/mocks/yahooFinance.mock";

// Mock Yahoo Finance functions
jest.mock("@/components/yahoo-finance/functions");

const mockGetStockDetails = getStockDetails as jest.MockedFunction<
  typeof getStockDetails
>;

describe("GET /api/stocks/details", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Query Parameter Validation", () => {
    it("should return 400 when symbol is missing", async () => {
      const request = new RequestBuilder("/api/stocks/details").build();
      const response = await GET(request);

      await expectErrorResponse(response, 400, "Symbol is required");
    });

    it("should return 400 when symbol is empty string", async () => {
      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 400, "Symbol is required");
    });

    it("should accept valid symbol strings", async () => {
      mockGetStockDetails.mockResolvedValue(mockStockDetails);

      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "AAPL" })
        .build();

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Successful Details Fetch", () => {
    beforeEach(() => {
      mockGetStockDetails.mockResolvedValue(mockStockDetails);
    });

    it("should return comprehensive stock details", async () => {
      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "AAPL" })
        .build();

      const response = await GET(request);
      const data = await expectJsonResponse(response, 200);

      expect(data.details).toBeDefined();
      expect(data.details).toEqual(mockStockDetails);
    });

    it("should pass symbol to getStockDetails", async () => {
      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "GOOGL" })
        .build();

      await GET(request);

      expect(mockGetStockDetails).toHaveBeenCalledWith(
        "GOOGL",
        expect.any(Array),
      );
    });

    it("should request correct Yahoo Finance modules", async () => {
      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "AAPL" })
        .build();

      await GET(request);

      const expectedModules = [
        "assetProfile",
        "price",
        "financialData",
        "defaultKeyStatistics",
        "earnings",
        "calendarEvents",
        "institutionOwnership",
      ];

      expect(mockGetStockDetails).toHaveBeenCalledWith("AAPL", expectedModules);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when getStockDetails fails", async () => {
      mockGetStockDetails.mockRejectedValue(
        new Error("Yahoo Finance API Error"),
      );

      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "INVALID" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 500, "Failed to fetch stock details");
    });

    it("should return 500 for invalid stock symbols", async () => {
      mockGetStockDetails.mockRejectedValue(new Error("Invalid symbol"));

      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "NOTREAL" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 500, "Failed to fetch stock details");
    });
  });

  describe("Edge Cases", () => {
    beforeEach(() => {
      mockGetStockDetails.mockResolvedValue(mockStockDetails);
    });

    it("should handle symbols with special characters (e.g., BRK.B)", async () => {
      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "BRK.B" })
        .build();

      await GET(request);

      expect(mockGetStockDetails).toHaveBeenCalledWith(
        "BRK.B",
        expect.any(Array),
      );
    });

    it("should handle international symbols", async () => {
      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "ASML.AS" })
        .build();

      await GET(request);

      expect(mockGetStockDetails).toHaveBeenCalledWith(
        "ASML.AS",
        expect.any(Array),
      );
    });

    it("should handle lowercase symbols", async () => {
      const request = new RequestBuilder("/api/stocks/details")
        .searchParams({ symbol: "aapl" })
        .build();

      await GET(request);

      expect(mockGetStockDetails).toHaveBeenCalledWith(
        "aapl",
        expect.any(Array),
      );
    });
  });
});
