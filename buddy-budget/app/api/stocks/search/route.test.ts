import { NextRequest } from "next/server";
import { GET } from "./route";
import {
  searchStocks,
  getStockLogo,
} from "@/components/yahoo-finance/functions";
import { RequestBuilder } from "@/app/api/__tests__/utils/requestBuilder";
import {
  expectJsonResponse,
  expectErrorResponse,
} from "@/app/api/__tests__/utils/assertions";

// Mock Yahoo Finance functions
jest.mock("@/components/yahoo-finance/functions");

const mockSearchStocks = searchStocks as jest.MockedFunction<
  typeof searchStocks
>;
const mockGetStockLogo = getStockLogo as jest.MockedFunction<
  typeof getStockLogo
>;

describe("GET /api/stocks/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Query Parameter Validation", () => {
    it("should return 400 when query parameter is missing", async () => {
      const request = new RequestBuilder("/api/stocks/search").build();
      const response = await GET(request);

      await expectErrorResponse(response, 400, "Search query is required");
    });

    it("should return 400 when query is empty string", async () => {
      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 400, "Search query is required");
    });

    it("should return 400 when query is only whitespace", async () => {
      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "   " })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 400, "Search query is required");
    });
  });

  describe("Successful Search", () => {
    const mockResults = [
      {
        symbol: "AAPL",
        shortname: "Apple Inc.",
        quoteType: "EQUITY",
        longname: "Apple Inc.",
      },
      {
        symbol: "GOOGL",
        shortname: "Alphabet Inc.",
        quoteType: "EQUITY",
        longname: "Alphabet Inc. Class A",
      },
    ];

    beforeEach(() => {
      mockSearchStocks.mockResolvedValue(mockResults);
      mockGetStockLogo.mockResolvedValue("https://example.com/logo.png");
    });

    it("should return search results with logos", async () => {
      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "apple" })
        .build();

      const response = await GET(request);
      const data = await expectJsonResponse(response, 200);

      expect(data.results).toHaveLength(2);
      expect(data.results[0]).toHaveProperty("logoUrl");
      expect(data.results[1]).toHaveProperty("logoUrl");
      expect(mockSearchStocks).toHaveBeenCalledWith("apple");
      expect(mockGetStockLogo).toHaveBeenCalledTimes(2);
    });

    it("should filter out results without symbols", async () => {
      mockSearchStocks.mockResolvedValue([
        { symbol: "AAPL", shortname: "Apple Inc." },
        { symbol: "", shortname: "No Symbol" },
        { shortname: "Also No Symbol" } as any,
      ]);

      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "test" })
        .build();

      const response = await GET(request);
      const data = await expectJsonResponse(response, 200);

      expect(data.results).toHaveLength(1);
      expect(data.results[0].symbol).toBe("AAPL");
    });

    it("should call getStockLogo with correct parameters", async () => {
      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "AAPL" })
        .build();

      await GET(request);

      expect(mockGetStockLogo).toHaveBeenCalledWith(
        "AAPL",
        "Apple Inc.",
        "EQUITY",
        "Apple Inc.",
      );
      expect(mockGetStockLogo).toHaveBeenCalledWith(
        "GOOGL",
        "Alphabet Inc.",
        "EQUITY",
        "Alphabet Inc. Class A",
      );
    });

    it("should handle results with missing optional fields", async () => {
      mockSearchStocks.mockResolvedValue([
        { symbol: "TEST", shortname: "Test Company" } as any,
      ]);

      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "test" })
        .build();

      const response = await GET(request);
      const data = await expectJsonResponse(response, 200);

      expect(data.results).toHaveLength(1);
      expect(mockGetStockLogo).toHaveBeenCalledWith("TEST", "Test Company", "", "");
    });

    it("should handle results with all optional fields present", async () => {
      mockSearchStocks.mockResolvedValue([
        {
          symbol: "TEST",
          shortname: "Test Co",
          quoteType: "EQUITY",
          longname: "Test Company Inc"
        } as any,
      ]);

      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "test" })
        .build();

      const response = await GET(request);

      expect(mockGetStockLogo).toHaveBeenCalledWith(
        "TEST",
        "Test Co",
        "EQUITY",
        "Test Company Inc"
      );
    });

    it("should handle results with null/undefined optional fields", async () => {
      mockSearchStocks.mockResolvedValue([
        {
          symbol: "TEST",
          shortname: null,
          quoteType: undefined,
          longname: null
        } as any,
      ]);

      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "test" })
        .build();

      const response = await GET(request);

      expect(mockGetStockLogo).toHaveBeenCalledWith("TEST", "", "", "");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when searchStocks fails", async () => {
      mockSearchStocks.mockRejectedValue(new Error("Yahoo Finance API Error"));

      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "test" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 500, "Failed to search stocks");
    });

    it("should return 500 when logo fetching fails", async () => {
      mockSearchStocks.mockResolvedValue([
        { symbol: "AAPL", shortname: "Apple Inc." },
      ]);
      mockGetStockLogo.mockRejectedValue(new Error("Logo fetch failed"));

      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "test" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 500, "Failed to search stocks");
    });
  });

  describe("Edge Cases", () => {
    beforeEach(() => {
      mockSearchStocks.mockResolvedValue([]);
      mockGetStockLogo.mockResolvedValue("https://example.com/logo.png");
    });

    it("should handle empty search results", async () => {
      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "nonexistent" })
        .build();

      const response = await GET(request);
      const data = await expectJsonResponse(response, 200);

      expect(data.results).toHaveLength(0);
    });

    it("should handle special characters in query", async () => {
      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: "BRK.B" })
        .build();

      await GET(request);

      expect(mockSearchStocks).toHaveBeenCalledWith("BRK.B");
    });

    it("should handle very long query strings", async () => {
      const longQuery = "a".repeat(100);
      const request = new RequestBuilder("/api/stocks/search")
        .searchParams({ q: longQuery })
        .build();

      await GET(request);

      expect(mockSearchStocks).toHaveBeenCalledWith(longQuery);
    });
  });
});
