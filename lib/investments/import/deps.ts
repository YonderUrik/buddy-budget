import "server-only";
import { and, eq, min } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { investmentTransactions } from "@/lib/db/schema/investments";
import { ensureHistorySafely } from "@/lib/investments/history";
import { createOrReuseInstrument } from "@/lib/investments/instruments";
import type { IsinListingsDeps } from "@/lib/investments/isin-listings";
import { autoLinkQuotation } from "@/lib/investments/link-quotation";
import { getUserCurrency, todayKey } from "@/lib/investments/operations";
import { listingsOnOpenFigi, marketDataDeps, quoteMetaOnProviders } from "@/lib/market-data/runtime";
import { updateFxRates } from "@/lib/market-data/update";
import { logger } from "@/lib/observability";
import type { ImportDeps } from "./execute";

const quotationDeps: IsinListingsDeps = { listings: listingsOnOpenFigi, quoteMeta: quoteMetaOnProviders };

/**
 * The real dependencies of an investment import, the same for the HTTP route and the CSV worker. `schedule` runs
 * the price history in the background: `after()` in a route, a detached promise in the long-lived worker.
 */
export async function investmentImportDeps(userId: string, schedule: (task: () => Promise<void>) => void): Promise<ImportDeps> {
  return {
    userCurrency: await getUserCurrency(userId),
    todayKey: todayKey(),
    createInstrument: (input) => createOrReuseInstrument(userId, input, { quoteMeta: quoteMetaOnProviders, listings: listingsOnOpenFigi }),
    fetchFx: async (currencies, from, to) => {
      try {
        await updateFxRates(currencies.filter((c) => c !== "EUR"), from, to, marketDataDeps());
      } catch (error) {
        logger.warn("market.fx.failed", { error });
      }
    },
    ensureHistory: async (instrument, from) => {
      // Uno strumento manuale con ISIN già nel catalogo dell'utente si collega alla quotazione verificata, come dal
      // pulsante «Cerca la quotazione»; lo storico riparte dalla sua prima operazione, anche precedente al file.
      const linked = await autoLinkQuotation(instrument, userId, quotationDeps);
      if (!linked) return ensureHistorySafely(instrument, from, schedule);
      logger.info("instrument.quotation.linked", { provider: "yahoo", symbol: linked.candidate.symbol });
      const [first] = await db
        .select({ date: min(investmentTransactions.date) })
        .from(investmentTransactions)
        .where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.instrumentId, instrument.id)));
      return ensureHistorySafely(linked.instrument, first?.date && first.date < from ? first.date : from, schedule);
    },
  };
}
