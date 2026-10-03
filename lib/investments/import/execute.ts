import "server-only";
import { db } from "@/lib/db/client";
import { investmentTransactions, type Instrument } from "@/lib/db/schema/investments";
import { buildFxTable, fxRateBetween } from "@/lib/calc/fx";
import type { RunImportInput } from "@/lib/validation/investments-import";
import type { CreateInstrumentOutcome } from "../instruments";
import { findVisibleInstrument } from "../instruments";
import { getOrCreateDefaultPortfolio, loadRatesBetween, loadUserTransactions } from "../data";
import { shiftDateKey, toRowValues } from "../operations";
import { planImport, type PlannedRow } from "./plan";
import type { ImportResult } from "./types";

/** Righe inserite per singola query. */
const INSERT_BATCH_SIZE = 500;

/** Dipendenze con rete o effetti fuori dal DB, iniettate per i test. */
export interface ImportDeps {
  userCurrency: string;
  todayKey: string;
  createInstrument(input: Extract<RunImportInput["instruments"][number], { create: unknown }>["create"]): Promise<CreateInstrumentOutcome>;
  /** Scarica i cambi mancanti tra due date. */
  fetchFx(currencies: string[], fromKey: string, toKey: string): Promise<void>;
  /** Avvia il recupero dei prezzi dello strumento dalla data (in background). */
  ensureHistory(instrument: Instrument, fromKey: string): Promise<void>;
}

function countRows(rows: PlannedRow[]): ImportResult["counts"] {
  return {
    new: rows.filter((r) => r.status === "new").length,
    duplicate: rows.filter((r) => r.status === "duplicate").length,
    error: rows.filter((r) => r.status === "error").length,
  };
}

function failure(rows: PlannedRow[], error?: string): ImportResult {
  return { rows, counts: countRows(rows), error, inserted: 0, instrumentsCreated: 0 };
}

/** Cambio di ogni operazione nuova; null dove manca anche dopo averlo chiesto alle fonti. */
async function resolveFxRates(
  ops: { line: number; date: string; currency: string }[],
  deps: ImportDeps
): Promise<Map<number, number | null>> {
  const foreign = ops.filter((op) => op.currency !== deps.userCurrency);
  const rates = new Map<number, number | null>(ops.filter((op) => op.currency === deps.userCurrency).map((op) => [op.line, 1]));
  if (foreign.length === 0) return rates;
  const currencies = [...new Set([deps.userCurrency, ...foreign.map((op) => op.currency)])];
  const dates = foreign.map((op) => op.date).sort();
  const [from, to] = [dates[0], dates.at(-1)!];
  const compute = async () => {
    const table = buildFxTable(await loadRatesBetween(currencies, from, to));
    for (const op of foreign) rates.set(op.line, fxRateBetween(table, op.currency, deps.userCurrency, op.date));
  };
  await compute();
  if (foreign.some((op) => rates.get(op.line) === null)) {
    await deps.fetchFx(currencies, shiftDateKey(from, -7), to);
    await compute();
  }
  return rates;
}

/**
 * Importa le operazioni di un file. Con `dryRun` dice solo cosa succederebbe (nuove, doppioni, errori) senza
 * scrivere né creare strumenti. Altrimenti è tutto o niente: con anche un solo errore non salva nessuna operazione.
 * Gli strumenti vengono creati prima (sono un catalogo condiviso: se poi l'import fallisce restano, e non è un danno).
 */
export async function runImport(userId: string, input: RunImportInput, deps: ImportDeps): Promise<ImportResult> {
  const instrumentByKey = new Map<string, Instrument | null>();
  let instrumentsCreated = 0;
  for (const entry of input.instruments) {
    if ("instrumentId" in entry) {
      const found = await findVisibleInstrument(userId, entry.instrumentId);
      if (!found) return failure([], "Uno degli strumenti scelti non esiste più");
      instrumentByKey.set(entry.key, found);
    } else if (input.dryRun) {
      instrumentByKey.set(entry.key, null);
    } else {
      const outcome = await deps.createInstrument(entry.create);
      if (!outcome.ok) return failure([], `Strumento "${entry.create.name}": ${outcome.error}`);
      if (outcome.created) instrumentsCreated += 1;
      instrumentByKey.set(entry.key, outcome.instrument);
    }
  }

  const operations = input.operations.filter((op) => instrumentByKey.has(op.key));
  if (operations.length !== input.operations.length) return failure([], "Alcune operazioni non hanno uno strumento");

  // Gli strumenti ancora da creare (prova) hanno un id provvisorio: nessuna operazione salvata da confrontare.
  const idOf = (key: string) => instrumentByKey.get(key)?.id ?? `nuovo:${key}`;
  const existing = (await loadUserTransactions(userId)).filter((t) => [...instrumentByKey.values()].some((i) => i?.id === t.instrumentId));
  const rows = planImport(
    operations.map((op) => ({ ...op, instrumentId: idOf(op.key) })),
    existing
  );
  for (const [index, op] of operations.entries()) {
    const entry = input.instruments.find((i) => i.key === op.key)!;
    const currency = instrumentByKey.get(op.key)?.currency ?? ("create" in entry && "currency" in entry.create ? entry.create.currency : undefined);
    if (op.sourceCurrency && currency && op.sourceCurrency !== currency) {
      rows[index] = { line: op.line, status: "error", message: "La valuta dello strumento non coincide con quella del file" };
    }
    if (op.date > deps.todayKey) rows[index] = { line: op.line, status: "error", message: "Data nel futuro" };
  }

  const fresh = operations.filter((_, i) => rows[i].status === "new");
  const known = fresh.filter((op) => instrumentByKey.get(op.key) || op.sourceCurrency);
  const fxByLine = await resolveFxRates(
    known.map((op) => ({ line: op.line, date: op.date, currency: op.sourceCurrency ?? instrumentByKey.get(op.key)!.currency })),
    deps
  );
  for (const [index, op] of operations.entries()) {
    if (rows[index].status === "new" && fxByLine.has(op.line) && fxByLine.get(op.line) === null) {
      rows[index] = { line: op.line, status: "error", message: "Cambio non disponibile per questa data" };
    }
  }

  const counts = countRows(rows);
  if (input.dryRun || counts.error > 0) return { rows, counts, inserted: 0, instrumentsCreated };

  const portfolio = await getOrCreateDefaultPortfolio(userId);
  const values = fresh.map((op) => ({
    userId,
    portfolioId: portfolio.id,
    instrumentId: idOf(op.key),
    ...toRowValues({
      ...op,
      fees: op.fees * (op.sourceCurrency ? fxByLine.get(op.line) ?? 1 : 1),
      taxes: op.taxes * (op.sourceCurrency ? fxByLine.get(op.line) ?? 1 : 1),
    }, fxByLine.get(op.line) ?? 1),
  }));
  await db.transaction(async (tx) => {
    for (let i = 0; i < values.length; i += INSERT_BATCH_SIZE) {
      await tx.insert(investmentTransactions).values(values.slice(i, i + INSERT_BATCH_SIZE));
    }
  });

  const firstDateByKey = new Map<string, string>();
  for (const op of fresh) {
    const current = firstDateByKey.get(op.key);
    if (!current || op.date < current) firstDateByKey.set(op.key, op.date);
  }
  for (const [key, date] of firstDateByKey) await deps.ensureHistory(instrumentByKey.get(key)!, date);
  return { rows, counts, inserted: values.length, instrumentsCreated };
}
