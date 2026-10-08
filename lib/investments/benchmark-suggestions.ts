/** ETF ad accumulazione per confronti immediati con i principali indici azionari. */
export const BENCHMARK_SUGGESTIONS = [
  {
    label: "S&P 500",
    description: "Grandi aziende statunitensi",
    name: "iShares Core S&P 500 UCITS ETF (Acc)",
    yahooSymbol: "CSPX.L",
    isin: "IE00B5BMR087",
  },
  {
    label: "MSCI World",
    description: "Azioni dei mercati sviluppati",
    name: "iShares Core MSCI World UCITS ETF (Acc)",
    yahooSymbol: "IWDA.AS",
    isin: "IE00B4L5Y983",
  },
  {
    label: "FTSE All-World",
    description: "Mercati sviluppati ed emergenti",
    name: "Vanguard FTSE All-World UCITS ETF (Acc)",
    yahooSymbol: "VWCE.DE",
    isin: "IE00BK5BQT80",
  },
  {
    label: "Nasdaq-100",
    description: "Grandi aziende non finanziarie del Nasdaq",
    name: "iShares NASDAQ 100 UCITS ETF (Acc)",
    yahooSymbol: "SXRV.DE",
    isin: "IE00B53SZB19",
  },
] as const;
