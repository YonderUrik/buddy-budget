import "server-only";
import type { Instrument } from "@/lib/db/schema/investments";
import { ensureHistory, marketDataDeps } from "@/lib/market-data/runtime";
import { updateFxRates } from "@/lib/market-data/update";
import { requestLogger } from "@/lib/observability";
import { shiftDateKey } from "./operations";

/** Giorni di prezzi chiesti prima di un'operazione, così il prezzo del giorno esiste anche dopo un weekend. */
export const HISTORY_MARGIN_DAYS = 7;

/** Avvia il recupero dei prezzi dall'operazione in poi, senza mai far fallire la richiesta che lo chiede. */
export async function ensureHistorySafely(
  instrument: Instrument,
  operationDate: string,
  schedule: (task: () => Promise<void>) => void
): Promise<void> {
  try {
    await ensureHistory(instrument, shiftDateKey(operationDate, -HISTORY_MARGIN_DAYS), schedule);
  } catch (error) {
    requestLogger().warn("market.backfill.not_started", { error });
  }
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
