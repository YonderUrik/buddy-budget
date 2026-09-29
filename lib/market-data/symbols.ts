import type { InstrumentType } from "@/lib/db/schema/investments";
import { BORSAITALIANA_EXCHANGE_BY_TYPE } from "./providers/borsaitaliana";
import type { ProviderId } from "./types";

/** Suffisso Yahoo → suffisso Stooq. Senza suffisso Yahoo = borsa USA. Borse non elencate: Stooq non usato. */
const STOOQ_SUFFIX: Record<string, string> = { "": ".us", DE: ".de", L: ".uk" };
/** Suffisso Yahoo → suffisso Alpha Vantage. */
const ALPHAVANTAGE_SUFFIX: Record<string, string> = { "": "", DE: ".DEX", L: ".LON", PA: ".PAR", AS: ".AMS" };
/** Id CoinGecko → codice Kraken della crypto (Kraken usa XBT per bitcoin e XDG per dogecoin). */
const KRAKEN_BASE: Record<string, string> = {
  bitcoin: "XBT",
  ethereum: "ETH",
  solana: "SOL",
  cardano: "ADA",
  ripple: "XRP",
  polkadot: "DOT",
  litecoin: "LTC",
  dogecoin: "XDG",
  chainlink: "LINK",
  avalanche: "AVAX",
  "avalanche-2": "AVAX",
  cosmos: "ATOM",
  uniswap: "UNI",
  stellar: "XLM",
  "bitcoin-cash": "BCH",
  tron: "TRX",
  near: "NEAR",
  aave: "AAVE",
  "matic-network": "POL",
  "polygon-ecosystem-token": "POL",
  algorand: "ALGO",
  filecoin: "FIL",
  "internet-computer": "ICP",
  "ethereum-classic": "ETC",
  "the-graph": "GRT",
  arbitrum: "ARB",
  optimism: "OP",
  sui: "SUI",
  aptos: "APT",
  tether: "USDT",
  "usd-coin": "USDC",
};

/** Divide un simbolo Yahoo in base e suffisso di borsa (`VWCE.DE` → `VWCE`, `DE`). Le classi `BRK-B` restano intere. */
export function splitYahooSymbol(symbol: string): { base: string; suffix: string } {
  const dot = symbol.lastIndexOf(".");
  if (dot <= 0) return { base: symbol, suffix: "" };
  return { base: symbol.slice(0, dot), suffix: symbol.slice(dot + 1).toUpperCase() };
}

/** Dati da cui si derivano i simboli di tutte le fonti. */
export interface SymbolSeed {
  isin: string | null;
  type: InstrumentType;
  currency: string;
  /** Simbolo Yahoo scelto dall'utente nella ricerca, se c'è. */
  yahooSymbol?: string | null;
  /** Id CoinGecko (solo crypto). */
  coingeckoId?: string | null;
}

/**
 * Simboli per ciascuna fonte derivati dal simbolo Yahoo, dall'ISIN e dal tipo. Una fonte assente dal risultato
 * non copre lo strumento e la catena la salta. Le derivazioni vanno confermate dalla prova di copertura.
 */
export function deriveSymbols(seed: SymbolSeed): Partial<Record<ProviderId, string>> {
  const symbols: Partial<Record<ProviderId, string>> = {};

  if (seed.type === "crypto") {
    if (seed.coingeckoId) {
      symbols.coingecko = `${seed.coingeckoId}:${seed.currency}`;
      const krakenBase = KRAKEN_BASE[seed.coingeckoId];
      if (krakenBase) symbols.kraken = `${krakenBase}${seed.currency}`;
    }
    return symbols;
  }

  if (seed.yahooSymbol) {
    symbols.yahoo = seed.yahooSymbol;
    const { base, suffix } = splitYahooSymbol(seed.yahooSymbol);
    const stooqSuffix = STOOQ_SUFFIX[suffix];
    if (stooqSuffix !== undefined) symbols.stooq = `${base}${stooqSuffix}`.toLowerCase();
    const avSuffix = ALPHAVANTAGE_SUFFIX[suffix];
    if (avSuffix !== undefined) symbols.alphavantage = `${base}${avSuffix}`;
    if (suffix === "" && seed.currency === "USD") symbols.twelvedata = base;
  }

  if (seed.isin) {
    const onMilan = seed.yahooSymbol ? splitYahooSymbol(seed.yahooSymbol).suffix === "MI" : false;
    const exchange = BORSAITALIANA_EXCHANGE_BY_TYPE[seed.type];
    // Le obbligazioni si cercano sul MOT anche senza simbolo Yahoo: spesso Yahoo non le ha.
    if (exchange && (seed.type === "obbligazione" || onMilan)) symbols.borsaitaliana = `${seed.isin},${exchange}`;
  }

  return symbols;
}
