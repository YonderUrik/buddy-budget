import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { interestRates, type InterestRateSeries } from "@/lib/db/schema/investments";
import type { RateInput } from "@/lib/calc/risk";
import { logger, type Logger } from "@/lib/observability";
import { estrProvider, type RateProvider } from "./providers/estr";
import type { ProviderContext } from "./types";

/** Primo giorno pubblicato della serie €STR. */
export const ESTR_HISTORY_START = "2019-10-01";
/** Giorni riletti a ogni aggiornamento (weekend, festivi, un giro saltato). */
export const ESTR_REFRESH_DAYS = 30;
const ESTR_SERIES: InterestRateSeries = "estr";
const INSERT_BATCH_SIZE = 500;

function shiftDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Aggiorna la serie €STR: gli ultimi `ESTR_REFRESH_DAYS` giorni, o tutta dal 2019 se non c'è ancora niente.
 * Restituisce quanti giorni ha salvato. Un errore della fonte non si propaga: non deve far fallire il cron.
 */
export async function updateRiskFreeRates(
  today: Date,
  ctx: ProviderContext,
  options: { provider?: RateProvider; log?: Logger } = {}
): Promise<number> {
  const provider = options.provider ?? estrProvider;
  const log = options.log ?? logger;
  try {
    const toKey = today.toISOString().slice(0, 10);
    const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(interestRates).where(eq(interestRates.series, ESTR_SERIES));
    const fromKey = existing && existing.count > 0 ? shiftDays(toKey, -ESTR_REFRESH_DAYS) : ESTR_HISTORY_START;
    const rates = await provider.fetchDailyRates(fromKey, toKey, ctx);
    for (let i = 0; i < rates.length; i += INSERT_BATCH_SIZE) {
      await db
        .insert(interestRates)
        .values(rates.slice(i, i + INSERT_BATCH_SIZE).map((r) => ({ series: ESTR_SERIES, date: r.date, rate: r.rate.toFixed(8), source: provider.id })))
        .onConflictDoUpdate({ target: [interestRates.series, interestRates.date], set: { rate: sql`excluded.rate`, source: sql`excluded.source` } });
    }
    if (rates.length > 0) log.info("market.rates.updated", { provider: provider.id, count: rates.length });
    return rates.length;
  } catch (error) {
    log.warn("market.rates.failed", { provider: provider.id, error });
    return 0;
  }
}

/** €STR salvato da `fromKey` (più un margine per avere il valore del primo giorno), dal più vecchio. */
export async function loadRiskFreeRates(fromKey: string): Promise<RateInput[]> {
  const rows = await db
    .select({ date: interestRates.date, rate: interestRates.rate })
    .from(interestRates)
    .where(and(eq(interestRates.series, ESTR_SERIES), gte(interestRates.date, shiftDays(fromKey, -10))))
    .orderBy(asc(interestRates.date));
  return rows.map((r) => ({ date: r.date, rate: Number(r.rate) }));
}
