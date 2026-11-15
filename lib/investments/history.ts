import "server-only";
import type { Instrument } from "@/lib/db/schema/investments";
import { findCoveredFrom } from "@/lib/market-data/store";
import { ensureHistory, marketDataDeps } from "@/lib/market-data/runtime";
import { DAILY_LOOKBACK_DAYS, updateFxRates } from "@/lib/market-data/update";
import { logger, requestLogger } from "@/lib/observability";
import { shiftDateKey, todayKey } from "./operations";

/** Days of prices requested before an operation, so the day's close exists after a weekend too. */
export const HISTORY_MARGIN_DAYS = 7;

/**
 * True when the stored closes already cover `fromKey` continuously up to `toKey`, so the backfill does not need
 * to be asked for.
 *
 * Looking at the oldest date alone is not enough, in two ways. First: an inner gap (partial import, a source
 * answering halfway) would leave the requested period empty. Second: a lone old close says nothing about the
 * requested period when the recent data starts after `fromKey`.
 */
export async function historyCovers(instrumentId: string, fromKey: string, toKey: string): Promise<boolean> {
  const coveredFrom = await findCoveredFrom(instrumentId, fromKey, toKey, DAILY_LOOKBACK_DAYS);
  return coveredFrom !== null && coveredFrom <= fromKey;
}

/** Starts the price backfill from the operation on, never failing the request that asks for it. */
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
 * Fetches in the background the FX rates of a currency from `fromKey` to today. Needed by the benchmark: when its
 * prices already existed, `ensureHistory` does not start and the rates of the older days could be missing. Never
 * fails the request that asks for it.
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

/** Fetches the missing FX rates around a date (to pre-fill the rate of an operation). */
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
