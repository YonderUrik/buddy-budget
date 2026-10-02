import "server-only";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { fxRates, instrumentPrices, userInstrumentPrices, type Instrument } from "@/lib/db/schema/investments";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { loadUserDebts } from "@/lib/debts/data";
import { buildDebtsView } from "@/lib/debts/view";
import { buildDebtHistoryRows } from "@/lib/net-worth/debt-history";
import { pensionTotalOn } from "@/lib/net-worth/pension-history";
import { loadUserPension } from "@/lib/pension/data";
import { loadUserTransactions } from "@/lib/investments/data";
import { shiftDateKey, toCalcInput, todayKey } from "@/lib/investments/operations";
import { loadTitleList, type TitleListItem } from "@/lib/investments/titles-list";
import { loadSymbols } from "@/lib/market-data/store";
import { splitYahooSymbol } from "@/lib/market-data/symbols";
import { buildSidebarPortfolio, type HoldingSignal } from "./portfolio";
import type { SidebarNetWorth, SidebarSummary, SidebarWatchItem } from "./types";

/** Giorni di prezzi e cambi letti: bastano per l'ultima chiusura e la precedente, anche dopo un lungo weekend. */
const PRICE_WINDOW_DAYS = 20;
/** Distanza dello storico confrontato per la variazione del patrimonio ("questo mese"). */
const NET_WORTH_COMPARE_DAYS = 30;
const LABEL_MAX_LENGTH = 8;

/** Sigla breve: la base del simbolo Yahoo (`VWCE.DE` → `VWCE`), altrimenti il nome (crypto, strumenti manuali). */
function shortLabel(instrument: Instrument, yahooSymbol: string | undefined): string {
  if (yahooSymbol) {
    const { base } = splitYahooSymbol(yahooSymbol);
    if (base.length <= LABEL_MAX_LENGTH) return base;
  }
  return instrument.name;
}

async function liquidity(userId: string): Promise<number> {
  const rows = await db.select({ balance: accounts.balance }).from(accounts).where(eq(accounts.userId, userId));
  return rows.reduce((sum, r) => sum + Number(r.balance), 0);
}

/** Patrimonio di circa 30 giorni fa (somma delle classi dell'ultimo giorno disponibile), o null. */
async function pastNetWorth(userId: string, today: string): Promise<number | null> {
  const target = shiftDateKey(today, -NET_WORTH_COMPARE_DAYS);
  const [latest] = await db
    .select({ date: netWorthSnapshots.date })
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), lte(netWorthSnapshots.date, target)))
    .orderBy(desc(netWorthSnapshots.date))
    .limit(1);
  if (!latest) return null;
  const rows = await db
    .select({ amount: netWorthSnapshots.amount })
    .from(netWorthSnapshots)
    .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.date, latest.date)));
  return rows.reduce((sum, r) => sum + Number(r.amount), 0);
}

function watchItem(item: TitleListItem, label: string): SidebarWatchItem {
  return {
    instrumentId: item.instrument.id,
    label,
    name: item.instrument.name,
    currency: item.instrument.currency,
    lastClose: item.lastClose,
    dayChangePct: item.dayChange,
    spark: item.spark,
    triggeredAlerts: item.triggeredAlerts,
  };
}

/**
 * Tutto ciò che la sidebar mostra: patrimonio e variazione del mese, portafoglio con posizioni, watchlist e avvisi
 * scattati. Query leggere (solo prezzi recenti): la sidebar è su ogni pagina.
 */
export async function loadSidebarSummary(userId: string): Promise<SidebarSummary> {
  const today = todayKey();
  const [[user], liquid, titles] = await Promise.all([
    db.select({ currency: authUser.currency }).from(authUser).where(eq(authUser.id, userId)),
    liquidity(userId),
    loadTitleList(userId),
  ]);
  const currency = user?.currency ?? "EUR";
  const symbols = await loadSymbols(titles.map((t) => t.instrument.id));
  const labelOf = (item: TitleListItem) => shortLabel(item.instrument, symbols.get(item.instrument.id)?.yahoo);

  const held = titles.filter((t) => t.held);
  const signals = new Map<string, HoldingSignal>(
    titles.map((t) => [
      t.instrument.id,
      { label: labelOf(t), dayChangePct: t.dayChange, spark: t.spark, triggeredAlerts: t.triggeredAlerts },
    ])
  );

  let portfolio = null;
  if (held.length > 0) {
    const heldIds = held.map((t) => t.instrument.id);
    const from = shiftDateKey(today, -PRICE_WINDOW_DAYS);
    const currencies = [...new Set([...held.map((t) => t.instrument.currency), currency])].filter((c) => c !== "EUR");
    const [transactions, prices, manualPrices, rates] = await Promise.all([
      loadUserTransactions(userId),
      db
        .select({ instrumentId: instrumentPrices.instrumentId, date: instrumentPrices.date, close: instrumentPrices.close, source: instrumentPrices.source })
        .from(instrumentPrices)
        .where(and(inArray(instrumentPrices.instrumentId, heldIds), gte(instrumentPrices.date, from))),
      db
        .select({ instrumentId: userInstrumentPrices.instrumentId, date: userInstrumentPrices.date, close: userInstrumentPrices.close })
        .from(userInstrumentPrices)
        .where(and(eq(userInstrumentPrices.userId, userId), inArray(userInstrumentPrices.instrumentId, heldIds))),
      currencies.length === 0
        ? Promise.resolve([])
        : db
            .select({ date: fxRates.date, currency: fxRates.currency, perEur: fxRates.perEur })
            .from(fxRates)
            .where(and(inArray(fxRates.currency, currencies), gte(fxRates.date, from))),
    ]);
    portfolio = buildSidebarPortfolio({
      transactions: transactions.map(toCalcInput),
      instruments: held.map((t) => t.instrument),
      prices,
      manualPrices,
      fxRates: rates,
      userCurrency: currency,
      todayKey: today,
      signals,
    });
  }

  // I debiti non sono negli snapshot: oggi vengono dalla vista, un mese fa dallo storico ricalcolato dai piani.
  const { debts: debtRows, events: debtEvents } = await loadUserDebts(userId);
  const debtsView = buildDebtsView(debtRows, debtEvents, today);
  const debtTotal = debtsView.overview.totalDebt;
  const pastDebtDate = shiftDateKey(today, -NET_WORTH_COMPARE_DAYS);
  const pastDebt = -Number(buildDebtHistoryRows(debtsView, today, pastDebtDate).find((r) => r.date === pastDebtDate)?.amount ?? 0);

  // Anche la previdenza non è negli snapshot: oggi e un mese fa è l'ultima fotografia nota di ogni fondo.
  const { funds: pensionFundRows } = await loadUserPension(userId);
  const pensionTotal = pensionTotalOn(pensionFundRows, today);
  const pastPension = pensionTotalOn(pensionFundRows, pastDebtDate);

  const hasAnyAccount = liquid !== 0 || portfolio !== null || debtTotal > 0 || pensionTotal > 0;
  let netWorth: SidebarNetWorth | null = null;
  if (hasAnyAccount) {
    const total = liquid + (portfolio?.totalValue ?? 0) + pensionTotal - debtTotal;
    const past = await pastNetWorth(userId, today);
    netWorth = { total, monthChange: past === null ? null : total - (past - pastDebt + pastPension) };
  }

  return {
    currency,
    netWorth,
    portfolio,
    watchlist: titles.filter((t) => t.watching && !t.held).map((t) => watchItem(t, labelOf(t))),
    triggeredAlerts: titles.reduce((sum, t) => sum + t.triggeredAlerts, 0),
  };
}
