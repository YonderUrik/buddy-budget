import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { instrumentPrices, userInstrumentPrices } from "@/lib/db/schema/investments";
import { buildPriceIndex, resolvePrice, type ResolvedPrice } from "@/lib/calc/investments";
import { PRICE_LOOKBACK_DAYS } from "./data";
import { shiftDateKey } from "./operations";

/**
 * Prezzo di uno strumento a una data, per precompilare un'operazione: la chiusura di quel giorno o, se manca
 * (weekend, festivi), l'ultima entro `PRICE_LOOKBACK_DAYS` giorni prima. Un prezzo manuale dell'utente vince su
 * quello delle fonti, come nel calcolo delle posizioni. Null se non c'è niente in quella finestra.
 */
export async function findPriceOnDate(userId: string, instrumentId: string, dateKey: string): Promise<ResolvedPrice | null> {
  const from = shiftDateKey(dateKey, -PRICE_LOOKBACK_DAYS);
  const [prices, manualPrices] = await Promise.all([
    db
      .select({
        instrumentId: instrumentPrices.instrumentId,
        date: instrumentPrices.date,
        close: instrumentPrices.close,
        source: instrumentPrices.source,
      })
      .from(instrumentPrices)
      .where(and(eq(instrumentPrices.instrumentId, instrumentId), gte(instrumentPrices.date, from), lte(instrumentPrices.date, dateKey))),
    db
      .select({ instrumentId: userInstrumentPrices.instrumentId, date: userInstrumentPrices.date, close: userInstrumentPrices.close })
      .from(userInstrumentPrices)
      .where(
        and(
          eq(userInstrumentPrices.userId, userId),
          eq(userInstrumentPrices.instrumentId, instrumentId),
          gte(userInstrumentPrices.date, from),
          lte(userInstrumentPrices.date, dateKey)
        )
      ),
  ]);
  return resolvePrice(buildPriceIndex(prices, manualPrices), instrumentId, dateKey);
}
