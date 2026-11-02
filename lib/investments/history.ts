import "server-only";
import type { Instrument } from "@/lib/db/schema/investments";
import { findCoveredFrom } from "@/lib/market-data/store";
import { ensureHistory, marketDataDeps } from "@/lib/market-data/runtime";
import { DAILY_LOOKBACK_DAYS, updateFxRates } from "@/lib/market-data/update";
import { logger, requestLogger } from "@/lib/observability";
import { shiftDateKey, todayKey } from "./operations";

/** Giorni di prezzi chiesti prima di un'operazione, così il prezzo del giorno esiste anche dopo un weekend. */
export const HISTORY_MARGIN_DAYS = 7;

/**
 * True se le chiusure salvate coprono già `fromKey` in modo continuo fino a `toKey`: in quel caso non serve
 * chiedere il recupero.
 *
 * Guardare la sola data più vecchia non basta, in due modi. Primo: un buco in mezzo (import parziale, fonte che
 * risponde a metà) lascerebbe il periodo richiesto vuoto. Secondo: un prezzo isolato vecchio non dice nulla sul
 * periodo richiesto quando i dati recenti cominciano dopo `fromKey`.
 */
export async function historyCovers(instrumentId: string, fromKey: string, toKey: string): Promise<boolean> {
  const coveredFrom = await findCoveredFrom(instrumentId, toKey, DAILY_LOOKBACK_DAYS);
  return coveredFrom !== null && coveredFrom <= fromKey;
}

/** Avvia il recupero dei prezzi dall'operazione in poi, senza mai far fallire la richiesta che lo chiede. */
export async function ensureHistorySafely(
  instrument: Instrument,
  operationDate: string,
  schedule: (task: () => Promise<void>) => void
): Promise<void> {
  try {
    const fromKey = shiftDateKey(operationDate, -HISTORY_MARGIN_DAYS);
    if (await historyCovers(instrument.id, fromKey, todayKey())) return;
    await ensureHistory(instrument, fromKey, schedule);
  } catch (error) {
    requestLogger().warn("market.backfill.not_started", { error });
  }
}

/**
 * Recupera in background i cambi di una valuta da `fromKey` a oggi. Serve al benchmark: se i suoi prezzi c'erano già,
 * `ensureHistory` non parte e i cambi dei giorni vecchi potrebbero mancare. Non fa mai fallire la richiesta.
 */
export function ensureFxHistorySafely(currency: string, fromKey: string, schedule: (task: () => Promise<void>) => void): void {
  if (currency === "EUR") return;
  schedule(async () => {
    try {
      await updateFxRates([currency], shiftDateKey(fromKey, -HISTORY_MARGIN_DAYS), new Date().toISOString().slice(0, 10), marketDataDeps());
    } catch (error) {
      logger.warn("market.fx.failed", { error });
    }
  });
}

/** Scarica i cambi mancanti attorno a una data (per precompilare il cambio di un'operazione). */
export async function fetchFxAround(currencies: string[], dateKey: string): Promise<void> {
  try {
    await updateFxRates(
      currencies.filter((c) => c !== "EUR"),
      shiftDateKey(dateKey, -HISTORY_MARGIN_DAYS),
      dateKey,
      marketDataDeps()
    );
  } catch (error) {
    requestLogger().warn("market.fx.failed", { error });
  }
}
