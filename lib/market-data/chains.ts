import type { ChainInstrument, ProviderId } from "./types";

/** Gruppi di strumenti che condividono lo stesso ordine di fonti. */
export type ChainKey = "etf_eu" | "stock_us" | "bond" | "fund" | "crypto";

/**
 * Ordine delle fonti per tipo di strumento (spec investimenti, sezione 2.1). Si modifica solo qui, dopo la prova
 * di copertura. Borsa Italiana si usa solo per gli strumenti che hanno un suo simbolo (quotati a Milano).
 */
export const PROVIDER_CHAINS: Record<ChainKey, readonly ProviderId[]> = {
  etf_eu: ["yahoo", "borsaitaliana", "stooq", "alphavantage"],
  stock_us: ["yahoo", "stooq", "twelvedata", "alphavantage"],
  bond: ["borsaitaliana", "yahoo"],
  fund: ["yahoo"],
  crypto: ["coingecko", "kraken"],
};

/** Gruppo di fonti per uno strumento: le azioni in dollari seguono la catena USA, il resto quella europea. */
export function chainKeyFor(instrument: ChainInstrument): ChainKey {
  switch (instrument.type) {
    case "crypto":
      return "crypto";
    case "obbligazione":
      return "bond";
    case "fondo":
      return "fund";
    case "azione":
      return instrument.currency === "USD" ? "stock_us" : "etf_eu";
    default:
      return "etf_eu";
  }
}

/** Fonti da provare per uno strumento, nell'ordine. */
export function chainFor(instrument: ChainInstrument): readonly ProviderId[] {
  return PROVIDER_CHAINS[chainKeyFor(instrument)];
}
