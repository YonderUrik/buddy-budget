/**
 * Common indices offered in «Confronta con un indice», each tracked through an accumulating UCITS ETF. Besides the ETF
 * (what the comparison really uses) every entry says in plain words what the index holds: where, how many companies
 * and in how many countries. The counts are rounded and change slowly (index reviews), so they are written as «about».
 */
export interface BenchmarkSuggestion {
  /** Stable id, also used in the logo route (`/api/benchmarks/[id]/logo`). */
  id: "sp500" | "msci-world" | "ftse-all-world" | "nasdaq-100";
  label: string;
  description: string;
  /** Where the index invests, in a few words. */
  area: string;
  /** Companies in the index, rounded. */
  companies: number;
  /** Countries in the index. */
  countries: number;
  /** Who computes the index, and the site the logo service knows it by. */
  provider: string;
  logoDomain: string;
  /** Short mark shown while the logo loads or when there is none. */
  monogram: string;
  name: string;
  /** Issuer and ticker of the ETF, shown on one short line. */
  etfShortName: string;
  yahooSymbol: string;
  isin: string;
}

export const BENCHMARK_SUGGESTIONS: readonly BenchmarkSuggestion[] = [
  {
    id: "sp500",
    label: "S&P 500",
    description: "Grandi aziende statunitensi",
    area: "Stati Uniti",
    companies: 500,
    countries: 1,
    provider: "S&P Dow Jones Indices",
    logoDomain: "spglobal.com",
    monogram: "S&P",
    name: "iShares Core S&P 500 UCITS ETF (Acc)",
    etfShortName: "iShares Core S&P 500",
    yahooSymbol: "CSPX.L",
    isin: "IE00B5BMR087",
  },
  {
    id: "msci-world",
    label: "MSCI World",
    description: "Azioni dei mercati sviluppati",
    area: "Paesi sviluppati",
    companies: 1350,
    countries: 23,
    provider: "MSCI",
    logoDomain: "msci.com",
    monogram: "MSCI",
    name: "iShares Core MSCI World UCITS ETF (Acc)",
    etfShortName: "iShares Core MSCI World",
    yahooSymbol: "IWDA.AS",
    isin: "IE00B4L5Y983",
  },
  {
    id: "ftse-all-world",
    label: "FTSE All-World",
    description: "Mercati sviluppati ed emergenti",
    area: "Tutto il mondo",
    companies: 4200,
    countries: 49,
    provider: "FTSE Russell",
    logoDomain: "lseg.com",
    monogram: "FTSE",
    name: "Vanguard FTSE All-World UCITS ETF (Acc)",
    etfShortName: "Vanguard FTSE All-World",
    yahooSymbol: "VWCE.DE",
    isin: "IE00BK5BQT80",
  },
  {
    id: "nasdaq-100",
    label: "Nasdaq-100",
    description: "Grandi aziende non finanziarie del Nasdaq",
    area: "Stati Uniti, molta tecnologia",
    companies: 100,
    countries: 1,
    provider: "Nasdaq",
    logoDomain: "nasdaq.com",
    monogram: "N100",
    name: "iShares NASDAQ 100 UCITS ETF (Acc)",
    etfShortName: "iShares Nasdaq 100",
    yahooSymbol: "SXRV.DE",
    isin: "IE00B53SZB19",
  },
];

/** The suggestion with this id, or null (the logo route only serves these). */
export function findBenchmarkSuggestion(id: string): BenchmarkSuggestion | null {
  return BENCHMARK_SUGGESTIONS.find((suggestion) => suggestion.id === id) ?? null;
}

/** The suggestion an instrument stands for (same ISIN or same name), so the dialog can mark the current one. */
export function matchBenchmarkSuggestion(instrument: { isin: string | null; name: string } | null): BenchmarkSuggestion | null {
  if (!instrument) return null;
  const name = instrument.name.replace(/[()]/g, "").trim().toLowerCase();
  return BENCHMARK_SUGGESTIONS.find((s) => s.isin === instrument.isin || s.name.replace(/[()]/g, "").trim().toLowerCase() === name) ?? null;
}
