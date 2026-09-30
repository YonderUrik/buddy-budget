import { splitYahooSymbol } from "./symbols";
import type { DailyClose, FxProvider, PriceProvider, ProviderId } from "./types";
import type { YahooSearchHit } from "./providers/yahoo";
import type { InflationProvider } from "./providers/eurostat";
import type { RateProvider } from "./providers/estr";
import type { FundamentalsProvider } from "./fundamentals";
import type { ProfileProvider } from "./profiles";
import type { DividendProvider } from "./dividends";

/**
 * Fonti finte per lo sviluppo locale e le verifiche con browser (`MARKET_DATA_FAKE=1`): prezzi deterministici
 * generati dal simbolo, nessuna chiamata di rete. Mai attive in produzione (vedi `isFakeMarketData`).
 */
export function isFakeMarketData(env: Record<string, string | undefined> = process.env): boolean {
  return env.MARKET_DATA_FAKE === "1" && env.NODE_ENV !== "production";
}

function hash(text: string): number {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

/** Chiusure finte: base tra 20 e 320 dal simbolo, oscillazione lenta, niente weekend (tranne crypto). */
export function fakeCloses(symbol: string, from: string, to: string, everyDay = false): DailyClose[] {
  const base = 20 + (hash(symbol) % 300);
  const closes: DailyClose[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (everyDay || (day !== 0 && day !== 6)) {
      const t = cursor.getTime() / 86_400_000;
      const close = base * (1 + 0.08 * Math.sin(t / 25) + 0.0004 * (t - 20_000));
      closes.push({ date: cursor.toISOString().slice(0, 10), close: Math.round(close * 100) / 100, currency: null });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return closes;
}

function fakeProvider(id: ProviderId): PriceProvider {
  return {
    id,
    requiredKeyEnv: null,
    maxHistory: "unlimited",
    minDelayMs: 0,
    async fetchDailyCloses(symbol, from, to) {
      return fakeCloses(symbol, from, to, id === "coingecko" || id === "kraken");
    },
  };
}

/** Tutte le fonti in versione finta. */
export const FAKE_PRICE_PROVIDERS: Record<ProviderId, PriceProvider> = {
  yahoo: fakeProvider("yahoo"),
  borsaitaliana: fakeProvider("borsaitaliana"),
  stooq: fakeProvider("stooq"),
  alphavantage: fakeProvider("alphavantage"),
  twelvedata: fakeProvider("twelvedata"),
  coingecko: fakeProvider("coingecko"),
  kraken: fakeProvider("kraken"),
};

const FAKE_PER_EUR: Record<string, number> = { USD: 1.1, GBP: 0.85, CHF: 0.95 };

/** Cambi finti costanti, un valore per giorno; le valute sconosciute non hanno cambi (come per una fonte vera). */
export const FAKE_FX_PROVIDER: FxProvider = {
  id: "ecb",
  async fetchRates(currencies, from, to) {
    return currencies
      .filter((currency) => currency in FAKE_PER_EUR)
      .flatMap((currency) =>
        fakeCloses(currency, from, to, true).map((c) => ({ date: c.date, currency, perEur: FAKE_PER_EUR[currency] }))
      );
  },
};

const FAKE_CATALOG: (YahooSearchHit & { keywords: string[] })[] = [
  { symbol: "VWCE.DE", name: "Vanguard FTSE All-World UCITS ETF (Acc)", exchange: "GER", exchangeLabel: "XETRA", type: "etf", keywords: ["vwce", "vanguard", "ie00bk5bqt80", "all-world"] },
  { symbol: "VWCE.MI", name: "Vanguard FTSE All-World UCITS ETF (Acc)", exchange: "MIL", exchangeLabel: "Milano", type: "etf", keywords: ["vwce", "vanguard", "ie00bk5bqt80", "all-world"] },
  { symbol: "SWDA.MI", name: "iShares Core MSCI World UCITS ETF", exchange: "MIL", exchangeLabel: "Milano", type: "etf", keywords: ["swda", "ishares", "ie00b4l5y983", "msci world"] },
  { symbol: "ENEL.MI", name: "Enel S.p.A.", exchange: "MIL", exchangeLabel: "Milano", type: "azione", keywords: ["enel", "it0003128367"] },
  { symbol: "VHYL.MI", name: "Vanguard FTSE All-World High Dividend Yield UCITS ETF (Dist)", exchange: "MIL", exchangeLabel: "Milano", type: "etf", keywords: ["vhyl", "vanguard", "ie00b8gkdb10", "high dividend"] },
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NMS", exchangeLabel: "NASDAQ", type: "azione", keywords: ["apple", "aapl", "us0378331005"] },
];

/** Ricerca finta su un piccolo catalogo. */
export function fakeSearch(query: string): YahooSearchHit[] {
  const q = query.trim().toLowerCase();
  return FAKE_CATALOG.filter((item) => item.keywords.some((k) => k.includes(q) || q.includes(k))).map((item) => ({
    symbol: item.symbol,
    name: item.name,
    exchange: item.exchange,
    exchangeLabel: item.exchangeLabel,
    type: item.type,
  }));
}

/** Valuta e borsa finte ricavate dal suffisso del simbolo. */
export function fakeQuoteMeta(symbol: string): { currency: string; exchange: string } {
  const { suffix } = splitYahooSymbol(symbol);
  if (suffix === "L") return { currency: "GBP", exchange: "LSE" };
  if (suffix === "") return { currency: "USD", exchange: "NMS" };
  return { currency: "EUR", exchange: suffix === "MI" ? "MIL" : "GER" };
}

/** Crypto finte per la ricerca. */
export function fakeCryptoSearch(query: string): { id: string; name: string; symbol: string }[] {
  const all = [
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
    { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  ];
  const q = query.trim().toLowerCase();
  return all.filter((c) => c.id.includes(q) || c.symbol.toLowerCase() === q);
}


/** Indice dei prezzi finto: 100 a gennaio 2015, +2% l'anno composto, fino al mese scorso (come Eurostat). */
export const FAKE_INFLATION_PROVIDER: InflationProvider = {
  id: "eurostat",
  async fetchMonthlyIndex(_area, fromMonth) {
    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
    const values = [];
    for (let year = 2000; year <= now.getUTCFullYear(); year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const key = `${year}-${String(month).padStart(2, "0")}`;
        if (key < fromMonth || key > lastMonth) continue;
        const monthsFrom2015 = (year - 2015) * 12 + (month - 1);
        values.push({ month: key, value: Math.round(100 * 1.02 ** (monthsFrom2015 / 12) * 100) / 100 });
      }
    }
    return values;
  },
};

/** €STR finto: 2% annuo in ogni giorno feriale. */
export const FAKE_RATE_PROVIDER: RateProvider = {
  id: "ecb",
  async fetchDailyRates(from, to) {
    return fakeCloses("estr", from, to).map((c) => ({ date: c.date, rate: 0.02 }));
  },
};

/** Profili finti: settori e primi titoli per gli ETF del catalogo, settore e paese per le azioni. */
export const FAKE_PROFILE_PROVIDER: ProfileProvider = {
  async fetchProfile(symbol, kind) {
    const { base } = splitYahooSymbol(symbol);
    if (kind === "company") {
      if (base === "AAPL") return { sectors: null, assetMix: null, holdings: null, sector: "tecnologia", country: "US" };
      if (base === "ENEL") return { sectors: null, assetMix: null, holdings: null, sector: "servizi_pubblici", country: "IT" };
      return null;
    }
    if (base === "VWCE" || base === "SWDA") {
      return {
        sectors: { tecnologia: 0.26, finanza: 0.16, salute: 0.1, industria: 0.11, consumi_ciclici: 0.11, comunicazioni: 0.08, consumi_difensivi: 0.06, energia: 0.04, materiali: 0.04, servizi_pubblici: 0.02, immobiliare: 0.02 },
        assetMix: { stock: 0.995, bond: 0, cash: 0.005, other: 0 },
        holdings: [
          { symbol: "NVDA", name: "NVIDIA Corp", weight: base === "VWCE" ? 0.048 : 0.055 },
          { symbol: "AAPL", name: "Apple Inc", weight: base === "VWCE" ? 0.042 : 0.049 },
          { symbol: "MSFT", name: "Microsoft Corp", weight: base === "VWCE" ? 0.039 : 0.045 },
          { symbol: "AMZN", name: "Amazon.com Inc", weight: base === "VWCE" ? 0.024 : 0.028 },
        ],
        sector: null,
        country: null,
      };
    }
    return null;
  },
};

/** Dividendi finti: mesi di stacco e importo per quota per simbolo base; gli altri non pagano. */
const FAKE_DIVIDENDS: Record<string, { months: number[]; day: number; amount: number }> = {
  ENEL: { months: [1, 7], day: 20, amount: 0.22 },
  AAPL: { months: [2, 5, 8, 11], day: 10, amount: 0.25 },
  VHYL: { months: [3, 6, 9, 12], day: 18, amount: 0.45 },
};

/** Storico dividendi finto degli ultimi 5 anni, fino a oggi. */
export const FAKE_DIVIDEND_PROVIDER: DividendProvider = {
  async fetchDividends(symbol) {
    const plan = FAKE_DIVIDENDS[splitYahooSymbol(symbol).base];
    if (!plan) return [];
    const today = new Date().toISOString().slice(0, 10);
    const thisYear = Number(today.slice(0, 4));
    const events = [];
    for (let year = thisYear - 5; year <= thisYear; year += 1) {
      for (const month of plan.months) {
        const exDate = `${year}-${String(month).padStart(2, "0")}-${String(plan.day).padStart(2, "0")}`;
        // Una piccola crescita annua, per avere qualcosa da mostrare.
        if (exDate <= today) events.push({ exDate, amount: Math.round(plan.amount * 1.05 ** (year - thisYear) * 10_000) / 10_000, currency: null });
      }
    }
    return events;
  },
};

/** Numeri chiave finti: costi e patrimonio per gli ETF del catalogo, multipli e margini per le azioni. */
export const FAKE_FUNDAMENTALS_PROVIDER: FundamentalsProvider = {
  async fetchFundamentals(symbol, kind) {
    const { base } = splitYahooSymbol(symbol);
    const empty = {
      marketCap: null, trailingPE: null, forwardPE: null, priceToBook: null, dividendYield: null, eps: null, beta: null,
      profitMargin: null, returnOnEquity: null, revenueGrowth: null, debtToEquity: null, expenseRatio: null, totalAssets: null,
    };
    if (kind === "fund") {
      if (base === "VWCE" || base === "SWDA") return { ...empty, expenseRatio: 0.0022, totalAssets: 8.5e9, beta: 1 };
      return null;
    }
    if (base === "AAPL") {
      return { ...empty, marketCap: 3.1e12, trailingPE: 31.2, forwardPE: 27.5, priceToBook: 46, dividendYield: 0.0045, eps: 6.4, beta: 1.2,
        profitMargin: 0.25, returnOnEquity: 1.5, revenueGrowth: 0.06, debtToEquity: 150 };
    }
    return null;
  },
};
