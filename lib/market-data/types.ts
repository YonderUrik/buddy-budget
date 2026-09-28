import type { FxProviderId, InstrumentType, ProviderId } from "@/lib/db/schema/investments";

export type { FxProviderId, ProviderId };

/**
 * Chiusura giornaliera restituita da una fonte. `currency` è null quando la fonte non la dichiara (es. i CSV di
 * Stooq): in quel caso vale la valuta della quotazione scelta col simbolo.
 */
export interface DailyClose {
  date: string;
  close: number;
  currency: string | null;
}

/** Dipendenze iniettate nelle fonti: in produzione `fetch` globale e `process.env`, nei test dei finti. */
export interface ProviderContext {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
}

/** Fonte di prezzi di mercato. Ogni fonte usa i propri simboli (vedi `instrument_symbols`). */
export interface PriceProvider {
  id: ProviderId;
  /** Variabile d'ambiente con la chiave obbligatoria; null se la fonte funziona senza. Senza chiave la fonte è spenta. */
  requiredKeyEnv: string | null;
  /** `limited`: storico corto o quota bassa, usata solo per l'aggiornamento giornaliero, mai per il recupero storico. */
  maxHistory: "unlimited" | "limited";
  /** Chiamate massime al giorno (fonti a quota), undefined se senza limite dichiarato. */
  dailyBudget?: number;
  /** Pausa minima tra due chiamate alla stessa fonte. */
  minDelayMs: number;
  /** Chiusure giornaliere tra `from` e `to` inclusi (chiavi YYYY-MM-DD). */
  fetchDailyCloses(symbol: string, from: string, to: string, ctx: ProviderContext): Promise<DailyClose[]>;
}

/** Cambio giornaliero con base EUR: 1 EUR = `perEur` unità di `currency`. */
export interface FxDailyRate {
  date: string;
  currency: string;
  perEur: number;
}

/** Fonte dei cambi. */
export interface FxProvider {
  id: FxProviderId;
  fetchRates(currencies: string[], from: string, to: string, ctx: ProviderContext): Promise<FxDailyRate[]>;
}

/** Strumento come serve alla catena: basta tipo e valuta. */
export interface ChainInstrument {
  type: InstrumentType;
  currency: string;
}

/** Esito di un tentativo su una fonte: enum chiuso, finisce nelle etichette delle metriche. */
export const PROVIDER_OUTCOMES = [
  "success",
  "empty",
  "currency_mismatch",
  "error",
  "rate_limited",
  "blocked",
  "skipped",
] as const;
export type ProviderOutcome = (typeof PROVIDER_OUTCOMES)[number];

/** Perché una fonte è stata saltata senza chiamarla. */
export type SkipReason = "no_key" | "no_symbol" | "circuit_open" | "budget_exhausted" | "limited_history";
