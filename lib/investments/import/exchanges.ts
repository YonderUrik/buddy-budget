/**
 * Interactive Brokers «Listing Exch» codes mapped to the OpenFIGI exchange codes the app links to Yahoo listings
 * (`OPENFIGI_EXCHANGE_SUFFIX`). With it, the ISIN of a statement is linked to the listing the user actually trades
 * (Intel on NASDAQ, Acomo in Amsterdam) instead of the first listing in the app's preference order (Milan, Xetra…).
 */
const IB_TO_OPENFIGI: Readonly<Record<string, string>> = {
  NASDAQ: "US", NYSE: "US", ARCA: "US", AMEX: "US", BATS: "US", IEX: "US", PINK: "US", "NYSE ARCA": "US",
  AEB: "NA",
  IBIS: "GY", IBIS2: "GY", FWB: "GR", FWB2: "GR", GETTEX: "GR", TGATE: "GR", SWB: "GR",
  BVME: "IM", "BVME.ETF": "IM",
  LSE: "LN", LSEETF: "LN", LSEIOB1: "LN",
  EBS: "SW", SWX: "SW",
  SBF: "FP",
};

/** OpenFIGI exchange code of an IB listing exchange, or null when the app does not link that exchange. */
export function ibListingToFigi(listingExchange: string | null | undefined): string | null {
  if (!listingExchange) return null;
  return IB_TO_OPENFIGI[listingExchange.trim().toUpperCase()] ?? null;
}
