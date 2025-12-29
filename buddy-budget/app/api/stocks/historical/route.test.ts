import { NextRequest } from "next/server";
import { GET } from "./route";
import { getHistoricalData } from "@/components/yahoo-finance/functions";
import { RequestBuilder } from "@/app/api/__tests__/utils/requestBuilder";
import {
  expectJsonResponse,
  expectErrorResponse,
} from "@/app/api/__tests__/utils/assertions";
import { mockHistoricalData } from "@/app/api/__tests__/mocks/yahooFinance.mock";

// Mock Yahoo Finance functions
jest.mock("@/components/yahoo-finance/functions");

const mockGetHistoricalData = getHistoricalData as jest.MockedFunction<
  typeof getHistoricalData
>;

describe("GET /api/stocks/historical", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHistoricalData.mockResolvedValue(mockHistoricalData);
  });

  describe("Query Parameter Validation", () => {
    it("should return 400 when symbol is missing", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({ startDate: "2024-01-01" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 400, "Symbol is required");
    });

    it("should return 400 when startDate is missing", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({ symbol: "AAPL" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 400, "Start date is required");
    });

    it("should return 400 when startDate is invalid", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({ symbol: "AAPL", startDate: "invalid-date" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 400, "Invalid start date");
    });

    it("should return 400 when endDate is invalid", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-01",
          endDate: "not-a-date",
        })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 400, "Invalid end date");
    });

    it("should accept valid parameters", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-01",
          endDate: "2024-01-31",
          interval: "1d",
        })
        .build();

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Date Parsing", () => {
    it("should parse ISO date strings correctly", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-01T00:00:00.000Z",
          endDate: "2024-01-31T23:59:59.999Z",
        })
        .build();

      await GET(request);

      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "AAPL",
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2024-01-31T23:59:59.999Z"),
        "1d",
      );
    });

    it("should parse YYYY-MM-DD format", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-01",
          endDate: "2024-01-31",
        })
        .build();

      await GET(request);

      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "AAPL",
        expect.any(Date),
        expect.any(Date),
        "1d",
      );
    });

    it("should default endDate to current date when not provided", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({ symbol: "AAPL", startDate: "2024-01-01" })
        .build();

      await GET(request);

      const [, , endDate] = mockGetHistoricalData.mock.calls[0];
      expect(endDate).toBeInstanceOf(Date);
      expect(endDate.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });
  });

  describe("Interval Validation", () => {
    it("should accept 1d interval", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-01",
          interval: "1d",
        })
        .build();

      await GET(request);

      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "AAPL",
        expect.any(Date),
        expect.any(Date),
        "1d",
      );
    });

    it("should accept 1wk interval", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-01",
          interval: "1wk",
        })
        .build();

      await GET(request);

      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "AAPL",
        expect.any(Date),
        expect.any(Date),
        "1wk",
      );
    });

    it("should accept 1mo interval", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-01",
          interval: "1mo",
        })
        .build();

      await GET(request);

      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "AAPL",
        expect.any(Date),
        expect.any(Date),
        "1mo",
      );
    });

    it("should default to 1d when interval not provided", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({ symbol: "AAPL", startDate: "2024-01-01" })
        .build();

      await GET(request);

      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "AAPL",
        expect.any(Date),
        expect.any(Date),
        "1d",
      );
    });
  });

  describe("Successful Historical Data Fetch", () => {
    it("should return historical data for valid inputs", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-01",
          endDate: "2024-01-31",
        })
        .build();

      const response = await GET(request);
      const data = await expectJsonResponse(response, 200);

      expect(data.data).toBeDefined();
      expect(data.data).toEqual(mockHistoricalData);
    });

    it("should pass correct parameters to getHistoricalData", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "GOOGL",
          startDate: "2023-06-01",
          endDate: "2023-12-31",
          interval: "1wk",
        })
        .build();

      await GET(request);

      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "GOOGL",
        new Date("2023-06-01"),
        new Date("2023-12-31"),
        "1wk",
      );
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when getHistoricalData fails", async () => {
      mockGetHistoricalData.mockRejectedValue(
        new Error("Yahoo Finance API Error"),
      );

      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({ symbol: "AAPL", startDate: "2024-01-01" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 500, "Failed to fetch historical data");
    });

    it("should return 500 for invalid stock symbols", async () => {
      mockGetHistoricalData.mockRejectedValue(new Error("Invalid symbol"));

      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({ symbol: "NOTREAL", startDate: "2024-01-01" })
        .build();

      const response = await GET(request);

      await expectErrorResponse(response, 500, "Failed to fetch historical data");
    });
  });

  describe("Edge Cases", () => {
    it("should handle startDate after endDate", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-12-31",
          endDate: "2024-01-01",
        })
        .build();

      const response = await GET(request);

      // Should not return 400 - let Yahoo Finance handle this
      expect(response.status).toBe(200);
    });

    it("should handle same startDate and endDate", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "2024-01-15",
          endDate: "2024-01-15",
        })
        .build();

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "AAPL",
        new Date("2024-01-15"),
        new Date("2024-01-15"),
        "1d",
      );
    });

    it("should handle very old start dates", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "AAPL",
          startDate: "1980-12-12",
          endDate: "2024-01-01",
        })
        .build();

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should handle symbols with special characters", async () => {
      const request = new RequestBuilder("/api/stocks/historical")
        .searchParams({
          symbol: "BRK.B",
          startDate: "2024-01-01",
        })
        .build();

      await GET(request);

      expect(mockGetHistoricalData).toHaveBeenCalledWith(
        "BRK.B",
        expect.any(Date),
        expect.any(Date),
        "1d",
      );
    });
  });
});
