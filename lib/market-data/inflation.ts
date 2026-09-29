import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inflationIndex } from "@/lib/db/schema/investments";
import type { InflationPoint } from "@/lib/calc/returns";
import { logger, type Logger } from "@/lib/observability";
import { eurostatProvider, type InflationProvider } from "./providers/eurostat";
import type { ProviderContext } from "./types";

/** Area dell'inflazione usata per il rendimento reale (Eurostat `geo`). */
export const DEFAULT_INFLATION_AREA = "IT";
/** Primo mese scaricato quando la tabella è vuota. */
export const INFLATION_HISTORY_START = "2000-01";
/** Mesi riletti a ogni aggiornamento: Eurostat può rivedere gli ultimi valori. */
export const INFLATION_REFRESH_MONTHS = 36;

function monthsBefore(today: Date, months: number): string {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, 1)).toISOString().slice(0, 7);
}

/**
 * Aggiorna l'indice dei prezzi dell'area: gli ultimi `INFLATION_REFRESH_MONTHS` mesi, o tutto dal 2000 se non c'è
 * ancora niente. Restituisce quanti mesi ha salvato. Un errore della fonte non si propaga: l'inflazione non deve
 * far fallire l'aggiornamento dei prezzi.
 */
export async function updateInflationIndex(
  today: Date,
  ctx: ProviderContext,
  options: { provider?: InflationProvider; area?: string; log?: Logger } = {}
): Promise<number> {
  const provider = options.provider ?? eurostatProvider;
  const area = options.area ?? DEFAULT_INFLATION_AREA;
  const log = options.log ?? logger;
  try {
    const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(inflationIndex).where(eq(inflationIndex.area, area));
    const fromMonth = existing && existing.count > 0 ? monthsBefore(today, INFLATION_REFRESH_MONTHS) : INFLATION_HISTORY_START;
    const values = await provider.fetchMonthlyIndex(area, fromMonth, ctx);
    if (values.length === 0) return 0;
    await db
      .insert(inflationIndex)
      .values(values.map((v) => ({ area, month: v.month, value: v.value.toFixed(4), source: provider.id })))
      .onConflictDoUpdate({
        target: [inflationIndex.area, inflationIndex.month],
        set: { value: sql`excluded.value`, source: sql`excluded.source`, updatedAt: sql`now()` },
      });
    log.info("market.inflation.updated", { provider: provider.id, count: values.length });
    return values.length;
  } catch (error) {
    log.warn("market.inflation.failed", { provider: provider.id, error });
    return 0;
  }
}

/** Indice mensile salvato dell'area, dal mese più vecchio. */
export async function loadInflationIndex(area: string = DEFAULT_INFLATION_AREA): Promise<InflationPoint[]> {
  const rows = await db
    .select({ month: inflationIndex.month, value: inflationIndex.value })
    .from(inflationIndex)
    .where(eq(inflationIndex.area, area))
    .orderBy(asc(inflationIndex.month));
  return rows.map((r) => ({ month: r.month, value: Number(r.value) }));
}
