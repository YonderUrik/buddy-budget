import type { Instrument } from "@/lib/db/schema/investments";
import { logger, recordPriceProviderRequest, type Logger } from "@/lib/observability";
import type { ProviderBudgetStore } from "./budget";
import { createChainRunState, runChain, type ChainAttempt, type ChainRunState } from "./chain";
import { chainFor } from "./chains";
import { FX_PROVIDERS, PRICE_PROVIDERS, type InflationProvider } from "./providers";
import {
  findHeldAutoInstruments,
  findLastClose,
  findNeededCurrencies,
  loadSymbols,
  saveFxRates,
  savePrices,
  saveSymbols,
} from "./store";
import { deriveSymbols } from "./symbols";
import type { FxProvider, PriceProvider, ProviderContext, ProviderId } from "./types";

/** Giorni riletti a ogni aggiornamento: coprono weekend, festivi e un giro saltato del cron. */
export const DAILY_LOOKBACK_DAYS = 7;
/** Il recupero storico non va oltre questo numero di anni. */
export const MAX_BACKFILL_YEARS = 20;

/** Dipendenze esterne dell'aggiornamento: iniettabili nei test. */
export interface MarketDataDeps {
  ctx: ProviderContext;
  budget: ProviderBudgetStore;
  providers?: Partial<Record<ProviderId, PriceProvider>>;
  fxProviders?: readonly FxProvider[];
  /** Fonte dell'indice d'inflazione (default Eurostat). */
  inflationProvider?: InflationProvider;
  log?: Logger;
  sleep?: (ms: number) => Promise<void>;
}

/** Riepilogo di un giro di aggiornamento: solo conteggi, nessun dato utente. */
export interface UpdateSummary {
  instruments: number;
  updated: number;
  fromFallback: number;
  failed: number;
  suspect: number;
  fxRates: number;
}

function dateKeyUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKeyUtc(date);
}

function recordAttempts(attempts: ChainAttempt[]): void {
  for (const attempt of attempts) recordPriceProviderRequest(attempt.provider, attempt.outcome);
}

/** Prima fonte della catena che sarebbe stata provata davvero (non saltata per chiave o simbolo). */
function firstUsableProvider(attempts: ChainAttempt[]): ProviderId | null {
  return attempts.find((a) => a.outcome !== "skipped" || a.reason === "circuit_open" || a.reason === "budget_exhausted")
    ?.provider ?? null;
}

/**
 * Completa i simboli mancanti derivandoli da quello Yahoo e dall'ISIN (nessuna chiamata di rete).
 * Restituisce i simboli aggiornati.
 */
export async function completeSymbols(
  instrument: Instrument,
  current: Partial<Record<ProviderId, string>>
): Promise<Partial<Record<ProviderId, string>>> {
  const coingeckoId = current.coingecko?.split(":")[0] ?? null;
  const derived = deriveSymbols({
    isin: instrument.isin,
    type: instrument.type,
    currency: instrument.currency,
    yahooSymbol: current.yahoo ?? null,
    coingeckoId,
  });
  const missing = Object.fromEntries(Object.entries(derived).filter(([provider]) => !current[provider as ProviderId]));
  if (Object.keys(missing).length > 0) await saveSymbols(instrument.id, missing);
  return { ...derived, ...current };
}

/** Aggiorna i cambi del periodo dalla prima fonte che risponde; restituisce quanti cambi ha salvato. */
export async function updateFxRates(currencies: string[], from: string, to: string, deps: MarketDataDeps): Promise<number> {
  if (currencies.length === 0) return 0;
  const log = deps.log ?? logger;
  for (const provider of deps.fxProviders ?? FX_PROVIDERS) {
    try {
      const rates = await provider.fetchRates(currencies, from, to, deps.ctx);
      if (rates.length > 0) return saveFxRates(rates, provider.id);
    } catch (error) {
      log.warn("market.fx.failed", { provider: provider.id, error });
    }
  }
  return 0;
}

/**
 * Aggiornamento giornaliero: per ogni strumento `auto` posseduto rilegge gli ultimi giorni dalla catena di fonti
 * e aggiorna i cambi. Un errore su uno strumento non ferma gli altri.
 */
export async function updateHeldInstruments(
  today: Date,
  deps: MarketDataDeps,
  onProgress?: (processed: number, total: number) => void
): Promise<UpdateSummary> {
  const log = deps.log ?? logger;
  const to = dateKeyUtc(today);
  const from = shiftDays(to, -DAILY_LOOKBACK_DAYS);
  const held = await findHeldAutoInstruments();
  const symbolsById = await loadSymbols(held.map((i) => i.id));
  const state = createChainRunState();
  const summary: UpdateSummary = { instruments: held.length, updated: 0, fromFallback: 0, failed: 0, suspect: 0, fxRates: 0 };

  for (const [index, instrument] of held.entries()) {
    try {
      const outcome = await updateInstrument(instrument, symbolsById.get(instrument.id) ?? {}, from, to, "daily", state, deps, log);
      if (outcome.source === null) summary.failed += 1;
      else {
        summary.updated += 1;
        if (outcome.fallback) summary.fromFallback += 1;
        if (outcome.suspect) summary.suspect += 1;
      }
    } catch (error) {
      summary.failed += 1;
      log.error("market.prices.failed", { error });
    }
    onProgress?.(index + 1, held.length);
  }

  summary.fxRates = await updateFxRates(await findNeededCurrencies(held), from, to, deps);
  return summary;
}

interface InstrumentUpdateOutcome {
  source: ProviderId | null;
  fallback: boolean;
  suspect: boolean;
  saved: number;
}

async function updateInstrument(
  instrument: Instrument,
  storedSymbols: Partial<Record<ProviderId, string>>,
  from: string,
  to: string,
  purpose: "daily" | "backfill",
  state: ChainRunState,
  deps: MarketDataDeps,
  log: Logger,
  onBatch?: (saved: number, total: number) => void
): Promise<InstrumentUpdateOutcome> {
  const symbols = await completeSymbols(instrument, storedSymbols);
  const lastClose = purpose === "daily" ? await findLastClose(instrument.id) : null;
  const result = await runChain({
    instrument,
    symbols,
    from,
    to,
    purpose,
    chain: chainFor(instrument),
    providers: deps.providers ?? PRICE_PROVIDERS,
    ctx: deps.ctx,
    state,
    budget: deps.budget,
    lastClose,
    dayKey: to,
    sleep: deps.sleep,
  });
  recordAttempts(result.attempts);
  const symbol = result.source ? symbols[result.source] : symbols.yahoo ?? Object.values(symbols)[0];

  if (!result.source) {
    log.warn("market.prices.failed", { symbol, reason: result.attempts.map((a) => `${a.provider}:${a.outcome}`).join(",") });
    return { source: null, fallback: false, suspect: false, saved: 0 };
  }
  const fallback = result.source !== firstUsableProvider(result.attempts);
  if (fallback) log.info("market.prices.fallback_used", { symbol, provider: result.source });
  if (result.suspect) log.warn("market.prices.suspect", { symbol, provider: result.source });

  const saved = await savePrices(instrument.id, result.closes, result.source, {
    overwrite: purpose === "daily",
    onBatch: onBatch ? (n) => onBatch(n, result.closes.length) : undefined,
  });
  return { source: result.source, fallback, suspect: result.suspect, saved };
}

/** Esito del recupero storico di uno strumento. */
export interface BackfillResult {
  source: ProviderId | null;
  saved: number;
}

/**
 * Recupera lo storico di uno strumento da `fromKey` a oggi, solo dalle fonti senza limiti di profondità, e i cambi
 * della sua valuta. Idempotente: i giorni già salvati non si toccano, quindi si può rilanciare dopo un'interruzione.
 */
export async function backfillInstrument(
  instrument: Instrument,
  fromKey: string,
  today: Date,
  deps: MarketDataDeps,
  onProgress?: (saved: number, total: number) => void
): Promise<BackfillResult> {
  const log = deps.log ?? logger;
  const to = dateKeyUtc(today);
  const minFrom = shiftDays(to, -MAX_BACKFILL_YEARS * 366);
  const from = fromKey < minFrom ? minFrom : fromKey;
  const symbols = (await loadSymbols([instrument.id])).get(instrument.id) ?? {};
  const outcome = await updateInstrument(instrument, symbols, from, to, "backfill", createChainRunState(), deps, log, onProgress);
  if (instrument.currency !== "EUR") await updateFxRates([instrument.currency], from, to, deps);
  return { source: outcome.source, saved: outcome.saved };
}
