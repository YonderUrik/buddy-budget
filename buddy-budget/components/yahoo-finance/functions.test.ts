// Mock yahoo-finance2 with instance methods
jest.mock("yahoo-finance2", () => {
  const mockInstance = {
    quote: jest.fn(),
    search: jest.fn(),
    historical: jest.fn(),
    chart: jest.fn(),
    quoteSummary: jest.fn(),
    trendingSymbols: jest.fn(),
  };

  return jest.fn().mockImplementation(() => mockInstance);
});

import YahooFinance from "yahoo-finance2";

import {
  getStockQuote,
  getMultipleQuotes,
  searchStocks,
  getHistoricalData,
  getHistoricalDataByRange,
  getStockDetails,
  getCompanyProfile,
  getFinancialData,
  getTrendingStocks,
  calculatePortfolioValue,
  getStockPerformance,
  compareStocks,
  get52WeekPerformance,
} from "./functions";
import { getStockLogo } from "./types";

// Mock fetch for logo fetching
global.fetch = jest.fn();

// Get reference to the mocked instance
const MockedYahooFinance = YahooFinance as jest.MockedClass<
  typeof YahooFinance
>;
const mockYahooFinance = new MockedYahooFinance() as any;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe("Yahoo Finance Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // QUOTE FUNCTIONS
  // ============================================================================

  describe("getStockQuote", () => {
    it("should fetch and return a stock quote", async () => {
      const mockQuote = {
        symbol: "AAPL",
        shortName: "Apple Inc.",
        regularMarketPrice: 150.0,
        regularMarketChange: 2.5,
        regularMarketChangePercent: 1.69,
      };

      mockYahooFinance.quote.mockResolvedValue(mockQuote as any);

      const result = await getStockQuote("AAPL");

      expect(result).toEqual(mockQuote);
      expect(mockYahooFinance.quote).toHaveBeenCalledWith("AAPL");
    });

    it("should throw error when quote fetch fails", async () => {
      mockYahooFinance.quote.mockRejectedValue(new Error("API Error"));

      await expect(getStockQuote("INVALID")).rejects.toThrow("API Error");
    });
  });

  describe("getMultipleQuotes", () => {
    it("should fetch and return multiple stock quotes", async () => {
      const mockQuotes = [
        { symbol: "AAPL", regularMarketPrice: 150.0 },
        { symbol: "GOOGL", regularMarketPrice: 140.0 },
      ];

      mockYahooFinance.quote
        .mockResolvedValueOnce(mockQuotes[0] as any)
        .mockResolvedValueOnce(mockQuotes[1] as any);

      const result = await getMultipleQuotes(["AAPL", "GOOGL"]);

      expect(result).toEqual(mockQuotes);
      expect(mockYahooFinance.quote).toHaveBeenCalledTimes(2);
    });

    it("should throw error when any quote fetch fails", async () => {
      mockYahooFinance.quote.mockRejectedValue(new Error("API Error"));

      await expect(getMultipleQuotes(["AAPL", "INVALID"])).rejects.toThrow();
    });
  });

  // ============================================================================
  // SEARCH FUNCTIONS
  // ============================================================================

  describe("searchStocks", () => {
    it("should search and return stock results", async () => {
      const mockSearchResults = {
        quotes: [
          { symbol: "AAPL", shortname: "Apple Inc.", quoteType: "EQUITY" },
          { symbol: "GOOGL", shortname: "Alphabet Inc.", quoteType: "EQUITY" },
        ],
      };

      mockYahooFinance.search.mockResolvedValue(mockSearchResults as any);

      const result = await searchStocks("apple");

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe("AAPL");
      expect(mockYahooFinance.search).toHaveBeenCalledWith("apple");
    });

    it("should filter out INDEX and FUTURE quote types", async () => {
      const mockSearchResults = {
        quotes: [
          { symbol: "AAPL", shortname: "Apple Inc.", quoteType: "EQUITY" },
          { symbol: "SPX", shortname: "S&P 500", quoteType: "INDEX" },
          { symbol: "ESZ23", shortname: "E-mini S&P", quoteType: "FUTURE" },
          { symbol: "GOOGL", shortname: "Alphabet Inc.", quoteType: "EQUITY" },
        ],
      };

      mockYahooFinance.search.mockResolvedValue(mockSearchResults as any);

      const result = await searchStocks("test");

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.symbol === "SPX")).toBeUndefined();
      expect(result.find((r) => r.symbol === "ESZ23")).toBeUndefined();
    });

    it("should include results without quoteType property", async () => {
      const mockSearchResults = {
        quotes: [
          { symbol: "AAPL", shortname: "Apple Inc.", quoteType: "EQUITY" },
          { symbol: "TEST", shortname: "Test Company" }, // No quoteType
        ],
      };

      mockYahooFinance.search.mockResolvedValue(mockSearchResults as any);

      const result = await searchStocks("test");

      expect(result).toHaveLength(2);
    });

    it("should throw error when search fails", async () => {
      mockYahooFinance.search.mockRejectedValue(new Error("Search failed"));

      await expect(searchStocks("test")).rejects.toThrow("Search failed");
    });
  });

  // ============================================================================
  // HISTORICAL DATA FUNCTIONS
  // ============================================================================

  describe("getHistoricalData", () => {
    it("should fetch historical data with date range", async () => {
      const mockHistoricalData = [
        {
          date: new Date("2024-01-01"),
          open: 150,
          high: 155,
          low: 149,
          close: 154,
          adjClose: 154,
          volume: 1000000,
        },
      ];

      mockYahooFinance.historical.mockResolvedValue(mockHistoricalData as any);

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const result = await getHistoricalData("AAPL", startDate, endDate, "1d");

      expect(result).toEqual(mockHistoricalData);
      expect(mockYahooFinance.historical).toHaveBeenCalledWith("AAPL", {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      });
    });

    it("should use default end date (today) when not provided", async () => {
      mockYahooFinance.historical.mockResolvedValue([] as any);

      const startDate = new Date("2024-01-01");

      await getHistoricalData("AAPL", startDate);

      expect(mockYahooFinance.historical).toHaveBeenCalledWith("AAPL", {
        period1: startDate,
        period2: expect.any(Date),
        interval: "1d",
      });
    });

    it("should use default interval (1d) when not provided", async () => {
      mockYahooFinance.historical.mockResolvedValue([] as any);

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      await getHistoricalData("AAPL", startDate, endDate);

      expect(mockYahooFinance.historical).toHaveBeenCalledWith("AAPL", {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      });
    });

    it("should throw error when historical data fetch fails", async () => {
      mockYahooFinance.historical.mockRejectedValue(new Error("API Error"));

      await expect(
        getHistoricalData("AAPL", new Date(), new Date()),
      ).rejects.toThrow("API Error");
    });
  });

  describe("getHistoricalDataByRange", () => {
    it("should fetch historical data by range", async () => {
      const mockChartData = {
        quotes: [
          { date: new Date(), open: 150, high: 155, low: 149, close: 154 },
        ],
      };

      mockYahooFinance.chart.mockResolvedValue(mockChartData as any);

      const result = await getHistoricalDataByRange("AAPL", "1mo");

      expect(result).toEqual(mockChartData.quotes);
      expect(mockYahooFinance.chart).toHaveBeenCalledWith("AAPL", {
        period1: "1mo",
      });
    });

    it("should throw error when chart fetch fails", async () => {
      mockYahooFinance.chart.mockRejectedValue(new Error("Chart Error"));

      await expect(getHistoricalDataByRange("AAPL", "1y")).rejects.toThrow(
        "Chart Error",
      );
    });
  });

  // ============================================================================
  // DETAILED INFORMATION FUNCTIONS
  // ============================================================================

  describe("getStockDetails", () => {
    it("should fetch stock details with custom modules", async () => {
      const mockSummary = {
        price: { regularMarketPrice: 150 },
        assetProfile: { industry: "Technology" },
      };

      mockYahooFinance.quoteSummary.mockResolvedValue(mockSummary as any);

      const result = await getStockDetails("AAPL", ["price", "assetProfile"]);

      expect(result).toEqual(mockSummary);
      expect(mockYahooFinance.quoteSummary).toHaveBeenCalledWith("AAPL", {
        modules: ["price", "assetProfile"],
      });
    });

    it("should use default modules when not provided", async () => {
      mockYahooFinance.quoteSummary.mockResolvedValue({} as any);

      await getStockDetails("AAPL");

      expect(mockYahooFinance.quoteSummary).toHaveBeenCalledWith("AAPL", {
        modules: ["price", "summaryDetail", "assetProfile", "financialData"],
      });
    });

    it("should throw error when quote summary fails", async () => {
      mockYahooFinance.quoteSummary.mockRejectedValue(new Error("API Error"));

      await expect(getStockDetails("AAPL")).rejects.toThrow("API Error");
    });
  });

  describe("getCompanyProfile", () => {
    it("should fetch company profile", async () => {
      const mockProfile = {
        assetProfile: { industry: "Technology", sector: "Tech" },
      };

      mockYahooFinance.quoteSummary.mockResolvedValue(mockProfile as any);

      const result = await getCompanyProfile("AAPL");

      expect(result).toEqual(mockProfile);
      expect(mockYahooFinance.quoteSummary).toHaveBeenCalledWith("AAPL", {
        modules: ["assetProfile", "summaryProfile"],
      });
    });

    it("should throw error when profile fetch fails", async () => {
      mockYahooFinance.quoteSummary.mockRejectedValue(
        new Error("Profile Error"),
      );

      await expect(getCompanyProfile("AAPL")).rejects.toThrow("Profile Error");
    });
  });

  describe("getFinancialData", () => {
    it("should fetch financial data", async () => {
      const mockFinancials = {
        financialData: { revenue: 1000000 },
        earnings: { quarterly: [] },
      };

      mockYahooFinance.quoteSummary.mockResolvedValue(mockFinancials as any);

      const result = await getFinancialData("AAPL");

      expect(result).toEqual(mockFinancials);
      expect(mockYahooFinance.quoteSummary).toHaveBeenCalledWith("AAPL", {
        modules: ["financialData", "defaultKeyStatistics", "earnings"],
      });
    });

    it("should throw error when financial data fetch fails", async () => {
      mockYahooFinance.quoteSummary.mockRejectedValue(
        new Error("Financial Error"),
      );

      await expect(getFinancialData("AAPL")).rejects.toThrow("Financial Error");
    });
  });

  // ============================================================================
  // TRENDING FUNCTIONS
  // ============================================================================

  describe("getTrendingStocks", () => {
    it("should fetch trending stocks for default region (US)", async () => {
      const mockTrending = {
        quotes: [{ symbol: "AAPL" }, { symbol: "GOOGL" }],
      };

      mockYahooFinance.trendingSymbols.mockResolvedValue(mockTrending as any);

      const result = await getTrendingStocks();

      expect(result).toEqual(mockTrending);
      expect(mockYahooFinance.trendingSymbols).toHaveBeenCalledWith("US");
    });

    it("should fetch trending stocks for specific region", async () => {
      const mockTrending = { quotes: [] };

      mockYahooFinance.trendingSymbols.mockResolvedValue(mockTrending as any);

      await getTrendingStocks("GB");

      expect(mockYahooFinance.trendingSymbols).toHaveBeenCalledWith("GB");
    });

    it("should throw error when trending fetch fails", async () => {
      mockYahooFinance.trendingSymbols.mockRejectedValue(
        new Error("Trending Error"),
      );

      await expect(getTrendingStocks()).rejects.toThrow("Trending Error");
    });
  });

  // ============================================================================
  // PORTFOLIO TRACKING FUNCTIONS
  // ============================================================================

  describe("calculatePortfolioValue", () => {
    it("should calculate portfolio value and gains", async () => {
      const portfolio = [
        {
          symbol: "AAPL",
          shares: 10,
          purchasePrice: 100,
          purchaseDate: new Date("2023-01-01"),
        },
        {
          symbol: "GOOGL",
          shares: 5,
          purchasePrice: 80,
          purchaseDate: new Date("2023-01-01"),
        },
      ];

      mockYahooFinance.quote
        .mockResolvedValueOnce({ regularMarketPrice: 150 } as any)
        .mockResolvedValueOnce({ regularMarketPrice: 100 } as any);

      const result = await calculatePortfolioValue(portfolio);

      expect(result.totalCost).toBe(1400); // (10 * 100) + (5 * 80)
      expect(result.totalValue).toBe(2000); // (10 * 150) + (5 * 100)
      expect(result.totalGain).toBe(600);
      expect(result.totalGainPercent).toBeCloseTo(42.86, 2);
      expect(result.stocks).toHaveLength(2);
    });

    it("should handle stocks with zero or missing price", async () => {
      const portfolio = [
        {
          symbol: "AAPL",
          shares: 10,
          purchasePrice: 100,
          purchaseDate: new Date("2023-01-01"),
        },
      ];

      mockYahooFinance.quote.mockResolvedValue({} as any);

      const result = await calculatePortfolioValue(portfolio);

      expect(result.totalValue).toBe(0);
      expect(result.stocks[0].currentPrice).toBe(0);
    });

    it("should throw error when quote fetching fails", async () => {
      const portfolio = [
        {
          symbol: "AAPL",
          shares: 10,
          purchasePrice: 100,
          purchaseDate: new Date(),
        },
      ];

      mockYahooFinance.quote.mockRejectedValue(new Error("Quote Error"));

      await expect(calculatePortfolioValue(portfolio)).rejects.toThrow(
        "Quote Error",
      );
    });
  });

  describe("getStockPerformance", () => {
    it("should calculate stock performance over specified days", async () => {
      const mockHistoricalData = [
        { close: 100, date: new Date("2024-01-01") },
        { close: 110, date: new Date("2024-01-15") },
        { close: 120, date: new Date("2024-01-30") },
      ];

      mockYahooFinance.historical.mockResolvedValue(mockHistoricalData as any);

      const result = await getStockPerformance("AAPL", 30);

      expect(result.symbol).toBe("AAPL");
      expect(result.startPrice).toBe(100);
      expect(result.endPrice).toBe(120);
      expect(result.change).toBe(20);
      expect(result.changePercent).toBe(20);
      expect(result.dataPoints).toBe(3);
    });

    it("should use default 30 days when days not specified", async () => {
      mockYahooFinance.historical.mockResolvedValue([{ close: 100 }] as any);

      await getStockPerformance("AAPL");

      const callArgs = mockYahooFinance.historical.mock.calls[0];
      const startDate = callArgs[1].period1 as Date;
      const endDate = callArgs[1].period2 as Date;
      const daysDiff = Math.round(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      expect(daysDiff).toBe(30);
    });

    it("should throw error when no historical data available", async () => {
      mockYahooFinance.historical.mockResolvedValue([] as any);

      await expect(getStockPerformance("AAPL", 30)).rejects.toThrow(
        "No historical data available",
      );
    });

    it("should throw error when historical data fetch fails", async () => {
      mockYahooFinance.historical.mockRejectedValue(new Error("Data Error"));

      await expect(getStockPerformance("AAPL", 30)).rejects.toThrow(
        "Data Error",
      );
    });
  });

  // ============================================================================
  // MARKET ANALYSIS FUNCTIONS
  // ============================================================================

  describe("compareStocks", () => {
    it("should compare and sort stocks by performance", async () => {
      mockYahooFinance.historical
        .mockResolvedValueOnce([{ close: 100 }, { close: 110 }] as any)
        .mockResolvedValueOnce([{ close: 100 }, { close: 130 }] as any)
        .mockResolvedValueOnce([{ close: 100 }, { close: 105 }] as any);

      const result = await compareStocks(["AAPL", "GOOGL", "MSFT"], 30);

      expect(result).toHaveLength(3);
      // Should be sorted by changePercent descending
      expect(result[0].changePercent).toBeGreaterThan(result[1].changePercent);
      expect(result[1].changePercent).toBeGreaterThan(result[2].changePercent);
    });

    it("should throw error when comparison fails", async () => {
      mockYahooFinance.historical.mockRejectedValue(
        new Error("Comparison Error"),
      );

      await expect(compareStocks(["AAPL", "GOOGL"])).rejects.toThrow();
    });
  });

  describe("get52WeekPerformance", () => {
    it("should calculate 52-week performance metrics", async () => {
      const mockQuote = {
        regularMarketPrice: 150,
        fiftyTwoWeekHigh: 180,
        fiftyTwoWeekLow: 120,
      };

      mockYahooFinance.quote.mockResolvedValue(mockQuote as any);

      const result = await get52WeekPerformance("AAPL");

      expect(result.symbol).toBe("AAPL");
      expect(result.currentPrice).toBe(150);
      expect(result.fiftyTwoWeekHigh).toBe(180);
      expect(result.fiftyTwoWeekLow).toBe(120);
      expect(result.percentFromHigh).toBeCloseTo(-16.67, 2);
      expect(result.percentFromLow).toBeCloseTo(25, 2);
      expect(result.rangePosition).toBe(50);
    });

    it("should handle missing price data", async () => {
      mockYahooFinance.quote.mockResolvedValue({} as any);

      const result = await get52WeekPerformance("AAPL");

      expect(result.currentPrice).toBe(0);
      expect(result.fiftyTwoWeekHigh).toBe(0);
      expect(result.fiftyTwoWeekLow).toBe(0);
    });

    it("should throw error when quote fetch fails", async () => {
      mockYahooFinance.quote.mockRejectedValue(new Error("Quote Error"));

      await expect(get52WeekPerformance("AAPL")).rejects.toThrow("Quote Error");
    });
  });

  // ============================================================================
  // LOGO FUNCTIONS
  // ============================================================================

  describe("getStockLogo", () => {
    beforeEach(() => {
      mockFetch.mockClear();
    });

    it("should fetch logo for EQUITY type stocks", async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      const result = await getStockLogo("AAPL", "Apple Inc.", "EQUITY", "");

      expect(result).toContain("financialmodelingprep.com");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should fetch logo for ETF type stocks", async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      const result = await getStockLogo(
        "SPY",
        "SPDR S&P 500",
        "ETF",
        "SPDR S&P 500 ETF Trust",
      );

      expect(result).toContain("tradingview.com");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should fetch logo for MUTUALFUND type stocks", async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      const result = await getStockLogo(
        "VFIAX",
        "Vanguard 500",
        "MUTUALFUND",
        "Vanguard 500 Index Fund",
      );

      expect(result).toContain("tradingview.com");
    });

    it("should fetch logo for CRYPTOCURRENCY type", async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      const result = await getStockLogo(
        "BTC-USD",
        "Bitcoin USD",
        "CRYPTOCURRENCY",
        "",
      );

      expect(result).toContain("crypto");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should use shortName when longName is empty for ETF", async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      const result = await getStockLogo("SPY", "SPDR S&P 500", "ETF", "");

      expect(result).toContain("tradingview.com");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should try multiple logo URLs and return first successful one", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false } as Response)
        .mockResolvedValueOnce({ ok: true } as Response);

      const result = await getStockLogo("AAPL", "Apple Inc.", "EQUITY", "");

      expect(result).toBeTruthy();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return null when no logo URLs are available", async () => {
      const result = await getStockLogo("TEST", "Test", "UNKNOWN", "");

      expect(result).toBeNull();
    });

    it("should return null when all logo fetches fail", async () => {
      mockFetch.mockResolvedValue({ ok: false } as Response);

      const result = await getStockLogo("AAPL", "Apple Inc.", "EQUITY", "");

      expect(result).toBeNull();
    });

    it("should return null and log error when fetch throws", async () => {
      mockFetch.mockRejectedValue(new Error("Fetch Error"));

      const result = await getStockLogo("AAPL", "Apple Inc.", "EQUITY", "");

      expect(result).toBeNull();
    });

    it("should sanitize company names correctly", async () => {
      mockFetch.mockResolvedValue({ ok: true } as Response);

      await getStockLogo("AAPL", "Apple, Inc.", "EQUITY", "");

      const fetchCall = mockFetch.mock.calls[0][0] as string;

      expect(fetchCall).not.toContain(",");
      expect(fetchCall).not.toContain("inc");
    });
  });
});
