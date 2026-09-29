import { and, eq, inArray, lt, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import {
  fxRates,
  instrumentPrices,
  instruments,
  investmentTransactions,
  userInstrumentPrices,
} from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { buildFxTable } from "@/lib/calc/fx";
import { buildPriceIndex, computeDailyPortfolioValues, computePortfolioSummary } from "@/lib/calc/investments";
import { addDays, toDateKey } from "@/lib/calc/net-worth";
import { startOfDay } from "@/lib/calc/expenses";
import { loadInvestmentData, type InvestmentData } from "@/lib/investments/data";
import { hashUserId, logger } from "@/lib/observability";
import type { InvestmentHistoryStateStore } from "./history-state";
import { redisHistoryStateStore } from "./redis-history-state";

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
 * Profondità massima dello storico "investimenti", in anni: la stessa del recupero dei prezzi
 * (`MAX_BACKFILL_YEARS` in `lib/market-data/update.ts`), così un'operazione di anni fa entra nel patrimonio.
 */
export const MAX_INVESTMENT_HISTORY_YEARS = 20;

/** Aggregato "quante righe · ultima modifica" di una tabella: cambia a ogni insert, update o delete. */
function changeMarker(column: SQL | AnyColumn) {
  return sql<string>`count(*)::text || ':' || coalesce(max(${column})::text, '')`;
}

/**
 * Impronta dei dati da cui dipende lo storico investimenti dell'utente: operazioni, prezzi manuali, chiusure e
 * cambi degli strumenti posseduti, valuta dell'utente. Cambia quando si registra, modifica o elimina un'operazione
 * (anche datata anni fa), quando si inserisce un prezzo manuale e quando arriva lo storico prezzi in background.
 */
async function investmentInputsFingerprint(userId: string): Promise<string> {
  const heldInstruments = db
    .selectDistinct({ id: investmentTransactions.instrumentId })
    .from(investmentTransactions)
    .where(eq(investmentTransactions.userId, userId));
  const [[ops], [manual], [prices], [user]] = await Promise.all([
    db.select({ marker: changeMarker(investmentTransactions.updatedAt) }).from(investmentTransactions).where(eq(investmentTransactions.userId, userId)),
    db.select({ marker: changeMarker(userInstrumentPrices.updatedAt) }).from(userInstrumentPrices).where(eq(userInstrumentPrices.userId, userId)),
    db.select({ marker: changeMarker(instrumentPrices.createdAt) }).from(instrumentPrices).where(inArray(instrumentPrices.instrumentId, heldInstruments)),
    db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId)),
  ]);
  const currencies = db
    .selectDistinct({ currency: instruments.currency })
    .from(instruments)
    .where(inArray(instruments.id, heldInstruments));
  const [fx] = await db
    .select({ marker: changeMarker(fxRates.createdAt) })
    .from(fxRates)
    .where(or(inArray(fxRates.currency, currencies), eq(fxRates.currency, user?.currency ?? "EUR")));
  return [ops?.marker, manual?.marker, prices?.marker, fx?.marker, user?.currency].join("|");
}

async function readFingerprint(state: InvestmentHistoryStateStore, userId: string): Promise<string | null> {
  try {
    return await state.get(userId);
  } catch (error) {
    logger.warn("net_worth.history_state.unavailable", { user: hashUserId(userId), error });
    return null;
  }
}

async function saveFingerprint(state: InvestmentHistoryStateStore, userId: string, fingerprint: string): Promise<void> {
  try {
    await state.set(userId, fingerprint);
  } catch (error) {
    logger.warn("net_worth.history_state.unavailable", { user: hashUserId(userId), error });
  }
}

/** Elimina le righe "investimenti" dei giorni passati prima di `beforeKey` (esclusa). */
async function deletePastRowsBefore(userId: string, beforeKey: string): Promise<void> {
  await db
    .delete(netWorthSnapshots)
    .where(
      and(
        eq(netWorthSnapshots.userId, userId),
        eq(netWorthSnapshots.assetClass, "investimenti"),
        lt(netWorthSnapshots.date, beforeKey)
      )
    );
}

/**
 * Tiene allineato lo storico "investimenti" dei giorni passati (dalla prima operazione a ieri, massimo 20 anni) con
 * operazioni e prezzi salvati. Ricalcola solo se i dati sono cambiati dall'ultima volta (vedi
 * `investmentInputsFingerprint`), e allora riscrive i soli giorni il cui valore è cambiato: un'operazione inserita,
 * modificata o eliminata con una data passata aggiorna tutti i giorni da quella data in poi. Le righe reali
 * (`snapshot`) tengono la loro origine ma ricevono il valore ricalcolato; la riga di oggi non si tocca (la scrive il
 * cron della sera). Ritorna le righe scritte.
 */
export async function refreshDerivedInvestmentHistory(
  userId: string,
  today: Date = new Date(),
  state: InvestmentHistoryStateStore = redisHistoryStateStore
): Promise<number> {
  const todayStart = startOfDay(today);
  const todayKey = toDateKey(todayStart);
  const toKey = toDateKey(addDays(todayStart, -1));

  // Il giorno fa parte dell'impronta: ogni giorno nuovo allunga lo storico fino a ieri.
  const fingerprint = `${await investmentInputsFingerprint(userId)}|${toKey}`;
  if ((await readFingerprint(state, userId)) === fingerprint) return 0;

  const [first] = await db
    .select({ date: sql<string | null>`min(${investmentTransactions.date})` })
    .from(investmentTransactions)
    .where(eq(investmentTransactions.userId, userId));
  const cutoffKey = toDateKey(
    new Date(todayStart.getFullYear() - MAX_INVESTMENT_HISTORY_YEARS, todayStart.getMonth(), 1)
  );
  const fromKey = first?.date && first.date < cutoffKey ? cutoffKey : first?.date;

  // Nessuna operazione (o solo di oggi): nei giorni passati non c'era nulla investito.
  if (!first?.date || !fromKey || fromKey > toKey) {
    await deletePastRowsBefore(userId, todayKey);
    await saveFingerprint(state, userId, fingerprint);
    return 0;
  }

  const [data, existingRows] = await Promise.all([
    loadInvestmentData(userId, fromKey),
    db
      .select({ date: netWorthSnapshots.date, amount: netWorthSnapshots.amount })
      .from(netWorthSnapshots)
      .where(
        and(
          eq(netWorthSnapshots.userId, userId),
          eq(netWorthSnapshots.assetClass, "investimenti"),
          lt(netWorthSnapshots.date, todayKey)
        )
      ),
  ]);
  const existing = new Map(existingRows.map((r) => [r.date, r.amount]));

  const changed = computeDailyPortfolioValues({ ...calcInputs(data), fromKey, toKey })
    .map((p) => ({ date: p.date, amount: p.value.toFixed(2) }))
    .filter((p) => existing.get(p.date) !== p.amount);

  // Righe prima della prima operazione (es. è stata eliminata o spostata in avanti): non c'era nulla investito.
  await deletePastRowsBefore(userId, first.date);

  for (let i = 0; i < changed.length; i += SNAPSHOT_INSERT_BATCH_SIZE) {
    await db
      .insert(netWorthSnapshots)
      .values(
        changed.slice(i, i + SNAPSHOT_INSERT_BATCH_SIZE).map((p) => ({
          userId,
          date: p.date,
          assetClass: "investimenti" as const,
          amount: p.amount,
          source: "derivato" as const,
        }))
      )
      .onConflictDoUpdate({
        target: [netWorthSnapshots.userId, netWorthSnapshots.date, netWorthSnapshots.assetClass],
        set: { amount: sql`excluded.amount`, updatedAt: new Date() },
      });
  }

  await saveFingerprint(state, userId, fingerprint);
  return changed.length;
}
