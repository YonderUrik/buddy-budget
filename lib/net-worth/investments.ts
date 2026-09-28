import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { investmentTransactions } from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, computeDailyPortfolioValues, computePortfolioSummary } from "@/lib/calc/investments";
import { MAX_DERIVED_HISTORY_MONTHS, addDays, toDateKey } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import { loadInvestmentData, type InvestmentData } from "@/lib/investments/data";

/** Blocchi di insert delle righe ricostruite. */
const SNAPSHOT_INSERT_BATCH_SIZE = 500;

function calcInputs(data: InvestmentData) {
  const transactions = data.transactions.map((t) => ({
    id: t.id,
    instrumentId: t.instrumentId,
    type: t.type,
    date: t.date,
    quantity: t.quantity,
    price: t.price,
    fxRate: t.fxRate,
    fees: t.fees,
    taxes: t.taxes,
    grossAmount: t.grossAmount,
  }));
  return {
    transactions,
    instruments: data.instruments,
    priceIndex: buildPriceIndex(data.prices, data.manualPrices, transactions),
    fx: buildFxTable(data.fxRates),
    userCurrency: data.currency,
  };
}

/** Valore del portafoglio oggi, o null se l'utente non ha operazioni. */
export async function currentInvestmentValue(userId: string, today: Date = new Date()): Promise<number | null> {
  const todayKey = toDateKey(startOfDay(today));
  const data = await loadInvestmentData(userId, toDateKey(addDays(startOfDay(today), -31)));
  if (data.transactions.length === 0) return null;
  return computePortfolioSummary({ ...calcInputs(data), todayKey }).totalValue;
}

/** Scrive o aggiorna lo snapshot reale di oggi della classe "investimenti" (solo se l'utente ha operazioni). */
export async function writeInvestmentSnapshot(userId: string, today: Date = new Date()): Promise<void> {
  const value = await currentInvestmentValue(userId, today);
  if (value === null) return;
  const amount = value.toFixed(2);
  await db
    .insert(netWorthSnapshots)
    .values({ userId, date: toDateKey(today), assetClass: "investimenti", amount, source: "snapshot" })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.userId, netWorthSnapshots.date, netWorthSnapshots.assetClass],
      set: { amount, source: "snapshot", updatedAt: new Date() },
    });
}

/**
 * Ricostruisce lo storico "investimenti" (righe `derivato`) dalla prima operazione a ieri, massimo 24 mesi, con i
 * prezzi salvati. Riparte se è stata registrata un'operazione più vecchia dello storico esistente; non tocca mai le
 * righe reali (`snapshot`). Ritorna le righe scritte.
 */
export async function backfillDerivedInvestmentHistory(userId: string, today: Date = new Date()): Promise<number> {
  // Controlli economici prima di caricare operazioni e prezzi: la route li esegue a ogni apertura della Panoramica.
  const [first] = await db
    .select({ date: sql<string | null>`min(${investmentTransactions.date})` })
    .from(investmentTransactions)
    .where(eq(investmentTransactions.userId, userId));
  if (!first?.date) return 0;

  const todayStart = startOfDay(today);
  const cutoffKey = toDateKey(new Date(todayStart.getFullYear(), todayStart.getMonth() - MAX_DERIVED_HISTORY_MONTHS, 1));
  const fromKey = first.date < cutoffKey ? cutoffKey : first.date;
  const toKey = toDateKey(addDays(todayStart, -1));
  if (fromKey > toKey) return 0;

  const [existing] = await db
    .select({ first: sql<string | null>`min(${netWorthSnapshots.date})` })
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.assetClass, "investimenti")));
  if (existing?.first && existing.first <= fromKey) return 0;

  const data = await loadInvestmentData(userId, fromKey);

  await db
    .delete(netWorthSnapshots)
    .where(
      and(
        eq(netWorthSnapshots.userId, userId),
        eq(netWorthSnapshots.assetClass, "investimenti"),
        eq(netWorthSnapshots.source, "derivato")
      )
    );

  const points = computeDailyPortfolioValues({ ...calcInputs(data), fromKey, toKey });
  let written = 0;
  for (let i = 0; i < points.length; i += SNAPSHOT_INSERT_BATCH_SIZE) {
    const inserted = await db
      .insert(netWorthSnapshots)
      .values(
        points.slice(i, i + SNAPSHOT_INSERT_BATCH_SIZE).map((p) => ({
          userId,
          date: p.date,
          assetClass: "investimenti" as const,
          amount: p.value.toFixed(2),
          source: "derivato" as const,
        }))
      )
      .onConflictDoNothing()
      .returning({ id: netWorthSnapshots.id });
    written += inserted.length;
  }
  return written;
}
