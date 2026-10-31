/**
 * Moves an instrument with automatic prices (shared, or a user's private copy) to another Yahoo listing of the same security and downloads its history again. For an
 * instrument an import linked to a secondary listing with a short history (Intel on `0R24.L` instead of `INTC`),
 * which makes every past valuation of it empty. A dry run by default:
 *
 *   pnpm db:relink-instrument <instrumentId> <yahooSymbol>            # what would change
 *   pnpm db:relink-instrument <instrumentId> <yahooSymbol> --execute  # change it and download the history
 *
 * The new listing must exist on Yahoo in the instrument's own currency (quantities and prices do not change).
 * Requires DATABASE_URL and REDIS_URL like the app.
 */
import { and, eq, min, sql } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { instrumentPrices, instrumentSymbols, instruments, investmentTransactions } from "@/lib/db/schema/investments";
import { saveSymbols } from "@/lib/market-data/store";
import { deriveSymbols } from "@/lib/market-data/symbols";
import { backfillInstrument } from "@/lib/market-data/update";
import { marketDataDeps, quoteMetaOnProviders } from "@/lib/market-data/runtime";

/** History starts this many days before the first operation on the instrument, like the import does. */
const HISTORY_MARGIN_DAYS = 7;

async function main() {
  const [instrumentId, yahooSymbol] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const execute = process.argv.includes("--execute");
  if (!instrumentId || !yahooSymbol) throw new Error("Uso: pnpm db:relink-instrument <instrumentId> <yahooSymbol> [--execute]");
  const [instrument] = await db.select().from(instruments).where(eq(instruments.id, instrumentId));
  if (!instrument) throw new Error("Strumento non trovato");
  // Shared or private (a user's own copy an import linked to the wrong listing), as long as prices are automatic.
  if (instrument.priceMode !== "auto") throw new Error("Solo strumenti con prezzi automatici");
  const meta = await quoteMetaOnProviders(yahooSymbol);
  if (!meta?.currency) throw new Error(`${yahooSymbol} non esiste su Yahoo`);
  if (meta.currency !== instrument.currency) throw new Error(`${yahooSymbol} è quotato in ${meta.currency}, lo strumento in ${instrument.currency}`);
  const current = await db.select({ provider: instrumentSymbols.provider, symbol: instrumentSymbols.symbol }).from(instrumentSymbols).where(eq(instrumentSymbols.instrumentId, instrument.id));
  const [{ prices }] = await db.select({ prices: sql<number>`count(*)::int` }).from(instrumentPrices).where(eq(instrumentPrices.instrumentId, instrument.id));
  const [{ first }] = await db.select({ first: min(investmentTransactions.date) }).from(investmentTransactions).where(eq(investmentTransactions.instrumentId, instrument.id));
  const symbols = deriveSymbols({ isin: instrument.isin, type: instrument.type, currency: instrument.currency, yahooSymbol });
  const fromDate = new Date(`${first ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - HISTORY_MARGIN_DAYS);
  const fromKey = fromDate.toISOString().slice(0, 10);
  process.stdout.write(`${instrument.name} (${instrument.isin ?? "senza ISIN"}, ${instrument.currency})\n`);
  process.stdout.write(`  ora:    ${current.map((s) => `${s.provider}:${s.symbol}`).join(", ") || "nessun simbolo"} · ${prices} prezzi\n`);
  process.stdout.write(`  dopo:   ${Object.entries(symbols).map(([p, s]) => `${p}:${s}`).join(", ")} · storico dal ${fromKey} (${meta.exchange ?? "borsa sconosciuta"})\n`);
  if (!execute) { process.stdout.write("Prova: niente è cambiato. Aggiungi --execute per applicare.\n"); return; }
  await db.transaction(async (tx) => {
    await tx.delete(instrumentSymbols).where(eq(instrumentSymbols.instrumentId, instrument.id));
    await tx.delete(instrumentPrices).where(and(eq(instrumentPrices.instrumentId, instrument.id)));
    await tx.update(instruments).set({ exchange: meta.exchange }).where(eq(instruments.id, instrument.id));
  });
  await saveSymbols(instrument.id, symbols);
  const result = await backfillInstrument({ ...instrument, exchange: meta.exchange }, fromKey, new Date(), marketDataDeps());
  process.stdout.write(`Fatto: ${result.saved} prezzi scaricati${result.source ? ` da ${result.source}` : " (nessuna fonte ha risposto: riprova)"}.\n`);
}

main()
  .catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; })
  .finally(() => client.end());
