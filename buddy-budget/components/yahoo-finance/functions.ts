"use server";

/**
 * Yahoo Finance API Functions for Stock & Investment Tracking
 *
 * Install: npm install yahoo-finance2 (or bun/yarn/pnpm)
 * Documentation: https://github.com/gadicc/yahoo-finance2
 *
 * Note: This library cannot run in browsers due to CORS. Use it in API routes or server components.
 */

import YahooFinance from "yahoo-finance2";

import {
  StockQuote,
  HistoricalDataPoint,
  SearchResult,
  PortfolioStock,
} from "./types";

// Initialize the YahooFinance instance (v3 requirement)
const yahooFinance = new YahooFinance();

// ============================================================================
// RATE LIMITING & ERROR HANDLING
// ============================================================================

/**
 * Helper function to handle rate limiting errors with exponential backoff retry
 * @param fn - Function to execute
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 */
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limiting error
      const isRateLimitError =
        error?.message?.includes("Too Many Requests") ||
        error?.message?.includes("429") ||
        error?.name === "HTTPError" ||
        (typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          error.statusCode === 429);

      if (!isRateLimitError || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: wait longer with each retry
      const delay = initialDelay * Math.pow(2, attempt);

      console.warn(
        `Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================================================
// QUOTE FUNCTIONS - Get Current Stock Prices
// ============================================================================

/**
 * Get real-time quote for a single stock
 * @param symbol - Stock ticker symbol (e.g., 'AAPL', 'GOOGL')
 */
export async function getStockQuote(symbol: string): Promise<StockQuote> {
  try {
    const quote = await withRateLimitRetry(() => yahooFinance.quote(symbol));

    return quote as StockQuote;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get quotes for multiple stocks at once
 * @param symbols - Array of stock ticker symbols
 */
export async function getMultipleQuotes(
  symbols: string[],
): Promise<StockQuote[]> {
  try {
    const quotes = await Promise.all(
      symbols.map((symbol) => yahooFinance.quote(symbol)),
    );

    return quotes as StockQuote[];
  } catch (error) {
    console.error("Error fetching multiple quotes:", error);
    throw error;
  }
}

// ============================================================================
// SEARCH FUNCTIONS - Find Stocks
// ============================================================================

/**
 * Search for stocks, ETFs, mutual funds, etc.
 * @param query - Search term (company name or symbol)
 */
export async function searchStocks(query: string): Promise<SearchResult[]> {
  try {
    const results = await withRateLimitRetry(() => yahooFinance.search(query));

    return results.quotes.filter((result) => {
      // Type guard to check if result has quoteType property
      if ("quoteType" in result) {
        return result.quoteType !== "INDEX" && result.quoteType !== "FUTURE";
      }

      return true; // Include results without quoteType
    }) as SearchResult[];
  } catch (error) {
    console.error(`Error searching for "${query}":`, error);
    throw error;
  }
}

// ============================================================================
// HISTORICAL DATA - Get Past Price Data
// ============================================================================

/**
 * Get historical price data for a stock
 * @param symbol - Stock ticker symbol
 * @param period1 - Start date
 * @param period2 - End date (defaults to today)
 * @param interval - Data interval: '1d', '1wk', '1mo'
 */
export async function getHistoricalData(
  symbol: string,
  period1: Date,
  period2: Date = new Date(),
  interval: "1d" | "1wk" | "1mo" = "1d",
): Promise<HistoricalDataPoint[]> {
  try {
    const result = await withRateLimitRetry(() =>
      yahooFinance.historical(symbol, {
        period1,
        period2,
        interval,
      }),
    );

    return result as HistoricalDataPoint[];
  } catch (error) {
    console.error("Error fetching historical data for %s:", symbol, error);
    throw error;
  }
}

/**
 * Get historical data for a specific time range
 * @param symbol - Stock ticker symbol
 * @param range - Time range: '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'ytd', 'max'
 */
export async function getHistoricalDataByRange(
  symbol: string,
  range:
    | "1d"
    | "5d"
    | "1mo"
    | "3mo"
    | "6mo"
    | "1y"
    | "2y"
    | "5y"
    | "ytd"
    | "max",
): Promise<HistoricalDataPoint[]> {
  try {
    const result = await withRateLimitRetry(() =>
      yahooFinance.chart(symbol, {
        period1: range,
      }),
    );

    return result.quotes as unknown as HistoricalDataPoint[];
  } catch (error) {
    console.error("Error fetching historical data for %s:", symbol, error);
    throw error;
  }
}

// ============================================================================
// DETAILED INFORMATION - Company & Financial Data
// ============================================================================

/**
 * Get comprehensive stock information including company profile, financials, etc.
 * @param symbol - Stock ticker symbol
 * @param modules - Array of data modules to fetch
 */
export async function getStockDetails(
  symbol: string,
  modules: string[] = [
    "price",
    "summaryDetail",
    "assetProfile",
    "financialData",
  ],
) {
  try {
    const summary = await withRateLimitRetry(() =>
      yahooFinance.quoteSummary(symbol, {
        modules: modules as any,
      }),
    );

    return summary;
  } catch (error) {
    console.error("Error fetching details for %s:", symbol, error);
    throw error;
  }
}

/**
 * Get company profile information
 * @param symbol - Stock ticker symbol
 */
export async function getCompanyProfile(symbol: string) {
  try {
    const result = await withRateLimitRetry(() =>
      yahooFinance.quoteSummary(symbol, {
        modules: ["assetProfile", "summaryProfile"],
      }),
    );

    return result;
  } catch (error) {
    console.error("Error fetching company profile for %s:", symbol, error);
    throw error;
  }
}

/**
 * Get financial data (revenue, profit margins, etc.)
 * @param symbol - Stock ticker symbol
 */
export async function getFinancialData(symbol: string) {
  try {
    const result = await withRateLimitRetry(() =>
      yahooFinance.quoteSummary(symbol, {
        modules: ["financialData", "defaultKeyStatistics", "earnings"],
      }),
    );

    return result;
  } catch (error) {
    console.error(`Error fetching financial data for ${symbol}:`, error);
    throw error;
  }
}

// ============================================================================
// TRENDING & DISCOVERY
// ============================================================================

/**
 * Get currently trending stocks
 * @param region - Region code (default: 'US')
 */
export async function getTrendingStocks(region: string = "US") {
  try {
    const trending = await withRateLimitRetry(() =>
      yahooFinance.trendingSymbols(region),
    );

    return trending;
  } catch (error) {
    console.error("Error fetching trending stocks:", error);
    throw error;
  }
}

// ============================================================================
// PORTFOLIO TRACKING UTILITIES
// ============================================================================

/**
 * Calculate portfolio value and performance
 * @param portfolio - Array of portfolio stocks with purchase info
 */
export async function calculatePortfolioValue(portfolio: PortfolioStock[]) {
  try {
    const symbols = portfolio.map((stock) => stock.symbol);
    const quotes = await getMultipleQuotes(symbols);

    const portfolioData = portfolio.map((stock, index) => {
      const currentPrice = quotes[index].regularMarketPrice || 0;
      const currentValue = currentPrice * stock.shares;
      const costBasis = stock.purchasePrice * stock.shares;
      const gain = currentValue - costBasis;
      const gainPercent = (gain / costBasis) * 100;

      return {
        symbol: stock.symbol,
        shares: stock.shares,
        purchasePrice: stock.purchasePrice,
        currentPrice,
        costBasis,
        currentValue,
        gain,
        gainPercent,
        purchaseDate: stock.purchaseDate,
      };
    });

    const totalValue = portfolioData.reduce(
      (sum, item) => sum + item.currentValue,
      0,
    );
    const totalCost = portfolioData.reduce(
      (sum, item) => sum + item.costBasis,
      0,
    );
    const totalGain = totalValue - totalCost;
    const totalGainPercent = (totalGain / totalCost) * 100;

    return {
      stocks: portfolioData,
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
    };
  } catch (error) {
    console.error("Error calculating portfolio value:", error);
    throw error;
  }
}

/**
 * Get stock performance over time
 * @param symbol - Stock ticker symbol
 * @param days - Number of days to look back
 */
export async function getStockPerformance(symbol: string, days: number = 30) {
  try {
    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(startDate.getDate() - days);

    const historicalData = await getHistoricalData(symbol, startDate, endDate);

    if (historicalData.length === 0) {
      throw new Error("No historical data available");
    }

    const firstPrice = historicalData[0].close;
    const lastPrice = historicalData[historicalData.length - 1].close;
    const change = lastPrice - firstPrice;
    const changePercent = (change / firstPrice) * 100;

    return {
      symbol,
      startDate,
      endDate,
      startPrice: firstPrice,
      endPrice: lastPrice,
      change,
      changePercent,
      dataPoints: historicalData.length,
    };
  } catch (error) {
    console.error(`Error calculating performance for ${symbol}:`, error);
    throw error;
  }
}

// ============================================================================
// MARKET ANALYSIS HELPERS
// ============================================================================

/**
 * Compare multiple stocks' performance
 * @param symbols - Array of stock ticker symbols
 * @param days - Number of days to compare
 */
export async function compareStocks(symbols: string[], days: number = 30) {
  try {
    const performances = await Promise.all(
      symbols.map((symbol) => getStockPerformance(symbol, days)),
    );

    return performances.sort((a, b) => b.changePercent - a.changePercent);
  } catch (error) {
    console.error("Error comparing stocks:", error);
    throw error;
  }
}

/**
 * Get stock's 52-week high/low performance
 * @param symbol - Stock ticker symbol
 */
export async function get52WeekPerformance(symbol: string) {
  try {
    const quote = await getStockQuote(symbol);
    const current = quote.regularMarketPrice || 0;
    const high52 = quote.fiftyTwoWeekHigh || 0;
    const low52 = quote.fiftyTwoWeekLow || 0;

    const percentFromHigh = ((current - high52) / high52) * 100;
    const percentFromLow = ((current - low52) / low52) * 100;
    const rangePosition = ((current - low52) / (high52 - low52)) * 100;

    return {
      symbol,
      currentPrice: current,
      fiftyTwoWeekHigh: high52,
      fiftyTwoWeekLow: low52,
      percentFromHigh,
      percentFromLow,
      rangePosition, // 0-100, where position is in the 52-week range
    };
  } catch (error) {
    console.error(`Error fetching 52-week data for ${symbol}:`, error);
    throw error;
  }
}
