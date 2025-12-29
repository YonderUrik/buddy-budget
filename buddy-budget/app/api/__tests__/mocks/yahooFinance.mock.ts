/**
 * Mock data for Yahoo Finance API responses
 */

export const mockSearchResults = [
  {
    symbol: "AAPL",
    shortname: "Apple Inc.",
    longname: "Apple Inc.",
    exchange: "NMS",
    quoteType: "EQUITY",
  },
  {
    symbol: "GOOGL",
    shortname: "Alphabet Inc.",
    longname: "Alphabet Inc. Class A",
    exchange: "NMS",
    quoteType: "EQUITY",
  },
];

export const mockStockDetails = {
  price: {
    regularMarketPrice: 150.0,
    currency: "USD",
    marketCap: 2500000000000,
  },
  assetProfile: {
    industry: "Consumer Electronics",
    sector: "Technology",
    website: "https://www.apple.com",
    employees: 164000,
  },
  financialData: {
    currentPrice: 150.0,
    targetHighPrice: 200.0,
    targetLowPrice: 120.0,
    recommendationKey: "buy",
  },
  defaultKeyStatistics: {
    forwardPE: 25.5,
    trailingPE: 28.2,
    pegRatio: 2.1,
  },
  earnings: {
    financialsChart: {
      yearly: [],
      quarterly: [],
    },
  },
  calendarEvents: {
    earnings: {
      earningsDate: ["2024-02-01T00:00:00.000Z"],
    },
  },
  institutionOwnership: {
    ownershipList: [],
  },
};

export const mockHistoricalData = [
  {
    date: "2024-01-01T00:00:00.000Z",
    open: 150,
    high: 155,
    low: 149,
    close: 154,
    adjClose: 154,
    volume: 1000000,
  },
  {
    date: "2024-01-02T00:00:00.000Z",
    open: 154,
    high: 158,
    low: 153,
    close: 157,
    adjClose: 157,
    volume: 1100000,
  },
  {
    date: "2024-01-03T00:00:00.000Z",
    open: 157,
    high: 160,
    low: 156,
    close: 159,
    adjClose: 159,
    volume: 1050000,
  },
];

export const mockStockLogo = "https://example.com/logo.png";

/**
 * Factory function to create Yahoo Finance mocks
 */
export function createYahooFinanceMock() {
  return {
    searchStocks: jest.fn(() => Promise.resolve(mockSearchResults)),
    getStockDetails: jest.fn(() => Promise.resolve(mockStockDetails)),
    getHistoricalData: jest.fn(() => Promise.resolve(mockHistoricalData)),
    getStockLogo: jest.fn(() => Promise.resolve(mockStockLogo)),
    getStockQuote: jest.fn(() => Promise.resolve({})),
    getMultipleQuotes: jest.fn(() => Promise.resolve([])),
    getCompanyProfile: jest.fn(() => Promise.resolve({})),
    getFinancialData: jest.fn(() => Promise.resolve({})),
  };
}
