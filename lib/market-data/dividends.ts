import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { instrumentDividends, instruments, type Instrument, type InstrumentType } from "@/lib/db/schema/investments";
import { logger, type Logger } from "@/lib/observability";
import { fetchYahooDividends, type DividendEvent } from "./providers/yahoo";
import { loadSymbols } from "./store";
import type { ProviderContext } from "./types";

/** Uno storico dividendi più vecchio di così si riscarica (uno stacco nuovo arriva al massimo ogni qualche mese). */
export const DIVIDENDS_REFRESH_DAYS = 7;
/** Storici aggiornati al massimo in un giro del cron. */
export const DIVIDENDS_REFRESH_LIMIT = 20;
/** Storici scaricati al massimo quando la pagina trova strumenti mai scaricati. */
export const DIVIDENDS_ON_DEMAND_LIMIT = 5;
/** Tipi che pagano dividendi con uno storico sulla fonte (le cedole delle obbligazioni si calcolano dal tasso). */
export const DIVIDEND_TYPES: readonly InstrumentType[] = ["azione", "etf", "fondo"];

/** Fonte degli storici dividendi: Yahoo in produzione, finta in sviluppo e nei test. */
export interface DividendProvider {
  fetchDividends(symbol: string, ctx: ProviderContext): Promise<DividendEvent[]>;
}

export const yahooDividendProvider: DividendProvider = { fetchDividends: (symbol, ctx) => fetchYahooDividends(symbol, ctx) };

/** Esito dell'aggiornamento di uno storico: enum chiuso, finisce nei log. */
export type DividendsOutcome = "saved" | "empty" | "no_symbol" | "failed";

/** Uno strumento per cui ha senso chiedere lo storico dividendi. */
export function hasDividendHistory(instrument: Pick<Instrument, "type" | "priceMode">): boolean {
  return instrument.priceMode === "auto" && DIVIDEND_TYPES.includes(instrument.type);
}

/**
 * Scarica e salva lo storico dividendi di uno strumento. Gli stacchi in una valuta diversa da quella dello strumento
 * si scartano (quotazione sbagliata). Segna comunque lo scaricamento, così uno strumento senza dividendi (ETF ad
 * accumulazione) non si richiede ogni giorno. Non lancia mai.
 */
export async function refreshInstrumentDividends(
  instrument: Pick<Instrument, "id" | "currency">,
  yahooSymbol: string | null,
  ctx: ProviderContext,
  options: { provider?: DividendProvider; log?: Logger } = {}
): Promise<DividendsOutcome> {
  if (!yahooSymbol) return "no_symbol";
  const provider = options.provider ?? yahooDividendProvider;
  const log = options.log ?? logger;
  try {
    const events = (await provider.fetchDividends(yahooSymbol, ctx)).filter(
      (e) => e.currency === null || e.currency === instrument.currency
    );
    if (events.length > 0) {
      await db
        .insert(instrumentDividends)
        .values(events.map((e) => ({ instrumentId: instrument.id, exDate: e.exDate, amount: String(e.amount), source: "yahoo" as const })))
        .onConflictDoUpdate({
          target: [instrumentDividends.instrumentId, instrumentDividends.exDate],
          set: { amount: sql`excluded.amount` },
        });
    }
    await db.update(instruments).set({ dividendsFetchedAt: new Date() }).where(eq(instruments.id, instrument.id));
    return events.length > 0 ? "saved" : "empty";
  } catch (error) {
    log.warn("market.dividends.failed", { symbol: yahooSymbol, error });
    return "failed";
  }
}

/** Riepilogo di un giro di aggiornamento: solo conteggi. */
export interface DividendsSummary {
  candidates: number;
  saved: number;
  empty: number;
  failed: number;
}

/** Cron: aggiorna gli storici degli strumenti posseduti mai scaricati o più vecchi di `DIVIDENDS_REFRESH_DAYS`. */
export async function refreshStaleDividends(
  held: Instrument[],
  today: Date,
  ctx: ProviderContext,
  options: { provider?: DividendProvider; log?: Logger; limit?: number } = {}
): Promise<DividendsSummary> {
  const summary: DividendsSummary = { candidates: 0, saved: 0, empty: 0, failed: 0 };
  const log = options.log ?? logger;
  try {
    const staleBefore = new Date(today.getTime() - DIVIDENDS_REFRESH_DAYS * 86_400_000);
    const due = held
      .filter((i) => hasDividendHistory(i) && (!i.dividendsFetchedAt || i.dividendsFetchedAt < staleBefore))
      .sort((a, b) => (a.dividendsFetchedAt?.getTime() ?? 0) - (b.dividendsFetchedAt?.getTime() ?? 0))
      .slice(0, options.limit ?? DIVIDENDS_REFRESH_LIMIT);
    summary.candidates = due.length;
    const symbols = await loadSymbols(due.map((i) => i.id));
    for (const instrument of due) {
      const outcome = await refreshInstrumentDividends(instrument, symbols.get(instrument.id)?.yahoo ?? null, ctx, options);
      if (outcome === "saved") summary.saved += 1;
      else if (outcome === "empty") summary.empty += 1;
      else if (outcome === "failed") summary.failed += 1;
    }
    log.info("market.dividends.updated", { total: summary.candidates, processed: summary.saved, count: summary.empty });
  } catch (error) {
    log.warn("market.dividends.failed", { error });
  }
  return summary;
}

/** Strumenti tra quelli dati mai scaricati (per lo scaricamento su richiesta). */
export async function findInstrumentsWithoutDividends(list: Instrument[]): Promise<Instrument[]> {
  const eligible = list.filter(hasDividendHistory);
  if (eligible.length === 0) return [];
  const rows = await db
    .select({ id: instruments.id })
    .from(instruments)
    .where(and(inArray(instruments.id, eligible.map((i) => i.id)), isNull(instruments.dividendsFetchedAt)));
  const missing = new Set(rows.map((r) => r.id));
  return eligible.filter((i) => missing.has(i.id));
}

/** Stacco come arriva al client. */
export interface DividendRow {
  instrumentId: string;
  exDate: string;
  amount: string;
}

/** Storici dividendi salvati degli strumenti dati. */
export async function loadDividends(instrumentIds: string[]): Promise<DividendRow[]> {
  if (instrumentIds.length === 0) return [];
  return db
    .select({ instrumentId: instrumentDividends.instrumentId, exDate: instrumentDividends.exDate, amount: instrumentDividends.amount })
    .from(instrumentDividends)
    .where(inArray(instrumentDividends.instrumentId, instrumentIds))
    .orderBy(asc(instrumentDividends.exDate));
}
