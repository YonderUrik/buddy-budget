// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface StockQuote {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: Date;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  currency?: string;
  marketCap?: number;
}

export interface HistoricalDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

export interface SearchResult {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  quoteType?: string;
  typeDisp?: string;
  score?: number;
  index?: string;
  isYahooFinance?: boolean;
  logoUrl?: string | null;
  // Legacy fields (may vary by result)
  name?: string;
  exch?: string;
  type?: string;
}

export interface PortfolioStock {
  symbol: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: Date;
}

export async function getStockLogo(
  symbol: string,
  shortName: string,
  quoteType: string,
  longName: string,
): Promise<string | null> {
  try {
    let name = shortName
      .toLowerCase()
      .replace(/[,.\s']+/g, "-")
      .replace(/inc-?/g, "")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    let logoUrls = [];

    if (quoteType === "ETF" || quoteType === "MUTUALFUND") {
      name = (longName || shortName).toLowerCase().split(" ")[0];
      logoUrls.push(`https://s3-symbol-logo.tradingview.com/${name}.svg`);
      logoUrls.push(`https://s3-symbol-logo.tradingview.com/${name}-group.svg`);
      logoUrls.push(
        `https://s3-symbol-logo.tradingview.com/${name}-shares.svg`,
      );
      logoUrls.push(`https://s3-symbol-logo.tradingview.com/rex-${name}.svg`);
    } else if (quoteType === "CRYPTOCURRENCY") {
      name = `XTVC${symbol.split("-")[0]}`;
      logoUrls.push(
        `https://s3-symbol-logo.tradingview.com/crypto/${name}.svg`,
      );
    } else if (quoteType === "EQUITY") {
      logoUrls.push(
        `https://financialmodelingprep.com/image-stock/${symbol.split(".")[0]}.png`,
      );
      logoUrls.push(`https://s3-symbol-logo.tradingview.com/${name}.svg`);
      logoUrls.push(
        `https://s3-symbol-logo.tradingview.com/${name.split("-")[0]}.svg`,
      );
    }

    if (!logoUrls.length) {
      return null;
    }

    // Check if the logo exists by fetching it
    for (const logoUrl of logoUrls) {
      const response = await fetch(logoUrl, { method: "HEAD" });

      if (response.ok) {
        return logoUrl;
      }
    }

    return null;
  } catch (error) {
    console.error(`Error fetching logo for ${symbol}:`, error);

    return null;
  }
}
