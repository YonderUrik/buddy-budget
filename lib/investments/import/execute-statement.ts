import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { instruments, investmentPortfolios, investmentTransactions, userInstrumentPrices, type Instrument } from "@/lib/db/schema/investments";
import type { RunImportInput } from "@/lib/validation/investments-import";
import { findVisibleInstrument } from "../instruments";
import { toRowValues } from "../operations";
import { parseInteractiveBrokersActivity } from "./interactive-brokers";
import { resolveFxRates, type ImportDeps } from "./execute";
import { planImport } from "./plan";
import type { ImportResult } from "./types";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const failed = (error: string): ImportResult => ({ error, rows: [], counts: { new: 0, duplicate: 0, error: 1 }, inserted: 0, instrumentsCreated: 0 });

/** Import a full statement atomically after cash, positions and period continuity checks. */
export async function runStatementImport(userId: string, input: RunImportInput, deps: ImportDeps): Promise<ImportResult> {
  let parsed;
  try { parsed = parseInteractiveBrokersActivity(input.statementCsv!, deps.todayKey); }
  catch (e) { return failed(e instanceof Error ? e.message : "Rendiconto non valido"); }
  const statement = parsed.statement;
  if (!statement) return failed("Per l'import completo servono Cash Report e Net Asset Value");
  if (statement.to > deps.todayKey) return failed("Il rendiconto contiene date future");
  const errors = [...statement.issues, ...parsed.issues.filter((i) => i.severity === "error").map((i) => `Riga ${i.line}: ${i.message}`)];
  if (errors.length) return failed(errors.join("; "));
  const accountKey = hash(statement.account);
  const fingerprint = hash(JSON.stringify(parsed.records.map(({ section, kind, values }) => [section, kind, values])));
  const sourceRows = parsed.operations.map((op) => ({ line: op.line, status: "duplicate" as const }));
  const duplicate = (): ImportResult => ({ rows: sourceRows, counts: { new: 0, duplicate: sourceRows.length, error: 0 }, inserted: 0, instrumentsCreated: 0 });
  const existingDocs = await db.select().from(brokerStatements).where(and(eq(brokerStatements.userId, userId), eq(brokerStatements.accountKey, accountKey)));
  if (existingDocs.some((s) => s.fingerprint === fingerprint)) return duplicate();
  const selections = new Map(input.instruments.map((i) => [i.key, i]));
  if (parsed.identities.some((i) => !selections.has(i.key))) return failed("Il rendiconto va importato completo: abbina tutti gli strumenti, senza escluderli");
  // Client-supplied operations are deliberately ignored; the original CSV is reparsed on the server.
  const byKey = new Map<string, Instrument | null>(); let instrumentsCreated = 0;
  for (const identity of parsed.identities) {
    const entry = selections.get(identity.key)!;
    let instrument: Instrument | null;
    if ("instrumentId" in entry) instrument = await findVisibleInstrument(userId, entry.instrumentId);
    else if (input.dryRun) {
      // Reuse existing catalogue identity in previews too, otherwise a later statement falsely oversells.
      const matches = identity.isin ? await db.select().from(instruments).where(and(eq(instruments.isin, identity.isin), eq(instruments.currency, identity.currency!), sql`(${instruments.createdByUserId} is null or ${instruments.createdByUserId} = ${userId})`)) : [];
      instrument = matches[0] ?? null;
      if (!instrument && "currency" in entry.create && entry.create.currency !== identity.currency) return failed("La valuta proposta non coincide con il rendiconto");
    } else {
      const outcome = await deps.createInstrument(entry.create);
      if (!outcome.ok) return failed(outcome.error);
      instrument = outcome.instrument;
      if (outcome.created) instrumentsCreated++;
    }
    if ("instrumentId" in entry && !instrument) return failed("Strumento non accessibile");
    if (instrument?.createdByUserId && instrument.createdByUserId !== userId) return failed("Strumento non accessibile");
    if (instrument && (instrument.currency !== identity.currency || (identity.isin && instrument.isin && instrument.isin !== identity.isin))) return failed(`Strumento o valuta non corrispondenti per ${identity.symbol}`);
    byKey.set(identity.key, instrument);
  }
  const fx = await resolveFxRates([...parsed.operations.map((o) => ({ line: o.line, date: o.date, currency: o.sourceCurrency })), { line: -1, date: statement.to, currency: statement.currency }], deps);
  if ([...fx.values()].some((r) => r === null)) return failed("Cambio storico non disponibile: nessuna operazione salvata");
  const result = await db.transaction(async (tx): Promise<ImportResult> => {
    // Serialize imports per user: concurrent reimports cannot create duplicate portfolios, trades or ledgers.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const docs = await tx.select().from(brokerStatements).where(and(eq(brokerStatements.userId, userId), eq(brokerStatements.accountKey, accountKey)));
    if (docs.some((s) => s.fingerprint === fingerprint)) return duplicate();
    const overlapping = docs.filter((s) => s.from <= statement.to && s.to >= statement.from);
    if (overlapping.some((s) => s.from < statement.from || s.to > statement.to)) return failed("Sovrapposizione parziale: esporta un rendiconto che copra interamente i periodi da sostituire");
    const previous = docs.filter((s) => s.to < statement.from).sort((a, b) => b.to.localeCompare(a.to))[0];
    const later = docs.filter((s) => s.from > statement.to).sort((a, b) => a.from.localeCompare(b.from));
    if (later.length) {
      const next = new Date(`${statement.to}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      if (next.toISOString().slice(0, 10) !== later[0].from) return failed("Manca un periodo prima del rendiconto successivo");
      const currencies = new Set([...statement.cash, ...later[0].statement.cash].map((c) => c.currency));
      for (const currency of currencies) {
        const closing = statement.cash.find((c) => c.currency === currency)?.closing ?? 0;
        const opening = later[0].statement.cash.find((c) => c.currency === currency)?.opening ?? 0;
        if (Math.abs(closing - opening) > 0.0001) return failed(`Saldo ${currency} incompatibile con il rendiconto successivo: includilo nel nuovo export`);
      }
    }
    if (previous) {
      const next = new Date(`${previous.to}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      if (next.toISOString().slice(0, 10) !== statement.from) return failed("Manca un periodo tra questo rendiconto e il precedente");
    }
    if (previous?.statement.cash.some((cash) => Math.abs(cash.closing) > 0.0001 && !statement.cash.some((next) => next.currency === cash.currency))) return failed("Manca una valuta con saldo nel rendiconto precedente");
    for (const cash of statement.cash) {
      const opening = previous?.statement.cash.find((c) => c.currency === cash.currency)?.closing ?? 0;
      if (Math.abs(opening - cash.opening) > 0.0001) return failed(`Saldo iniziale ${cash.currency} diverso dalla chiusura precedente: importa prima lo storico mancante`);
    }
    const broker = `ibkr:${accountKey}`;
    let [portfolio] = await tx.select().from(investmentPortfolios).where(and(eq(investmentPortfolios.userId, userId), eq(investmentPortfolios.broker, broker)));
    const allExisting = portfolio ? await tx.select().from(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.portfolioId, portfolio.id))) : [];
    const existing = allExisting.filter((o) => o.date < statement.from);
    const following = allExisting.filter((o) => o.date > statement.to);
    const replacedOperations = allExisting.filter((o) => o.date >= statement.from && o.date <= statement.to).length;
    const replacement = overlapping.length ? { statements: overlapping.length, operations: replacedOperations, from: statement.from, to: statement.to } : undefined;
    const idOf = (key: string) => byKey.get(key)?.id ?? `new:${key}`;
    const ops = parsed.operations.map((o) => ({ ...o, instrumentId: idOf(o.key) }));
    const rows = planImport(ops, existing);
    if (rows.some((r) => r.status === "error")) return { rows, counts: { new: rows.filter((r) => r.status === "new").length, duplicate: rows.filter((r) => r.status === "duplicate").length, error: rows.filter((r) => r.status === "error").length }, inserted: 0, instrumentsCreated };
    const quantities = new Map<string, number>();
    for (const o of [...existing, ...ops.filter((_, i) => rows[i].status === "new")]) {
      const old = quantities.get(o.instrumentId) ?? 0; const q = Number(o.quantity);
      quantities.set(o.instrumentId, o.type === "acquisto" || o.type === "rettifica" ? old + q : o.type === "vendita" || o.type === "rimborso" ? old - q : old);
    }
    // Check every instrument, including positions that should be closed. Prior identities can be absent this year.
    const symbolById = new Map<string, string>();
    for (const i of parsed.identities) symbolById.set(idOf(i.key), `${i.symbol}:${i.currency}`);
    if (portfolio) {
      const previousInstruments = await tx.select().from(instruments).where(sql`${instruments.id} in (select instrument_id from investment_transactions where portfolio_id = ${portfolio!.id})`);
      for (const i of previousInstruments) {
        const record = [...parsed.records, ...docs.flatMap((d) => d.records)].find((r) => r.section === "Financial Instrument Information" && r.kind === "Data" && r.values[r.headers.indexOf("Security ID")] === i.isin);
        if (record && !symbolById.has(i.id)) symbolById.set(i.id, `${record.values[record.headers.indexOf("Symbol")].split(",")[0].trim()}:${i.currency}`);
      }
    }
    const expected = new Map(statement.positions.map((p) => [`${p.symbol}:${p.currency}`, p.quantity]));
    for (const [id, quantity] of quantities) {
      const symbol = symbolById.get(id);
      if (!symbol && Math.abs(quantity) > 1e-8) return failed("Posizione esistente non riconosciuta nel rendiconto");
      if (symbol && Math.abs(quantity - (expected.get(symbol) ?? 0)) > 1e-8) return failed(`Posizione ${symbol}: quantità importata ${quantity}, rendiconto ${expected.get(symbol) ?? 0}`);
      if (symbol) expected.delete(symbol);
    }
    if ([...expected.values()].some((q) => Math.abs(q) > 1e-8)) return failed("Il rendiconto contiene posizioni senza storico: importa prima gli acquisti precedenti");
    // A correction must not invalidate sales or closing quantities in retained later statements.
    const futurePlan = planImport(following.map((o, i) => ({ ...o, line: i + 1, quantity: Number(o.quantity), price: Number(o.price), grossAmount: o.grossAmount === null ? null : Number(o.grossAmount) })), [...existing, ...ops]);
    if (futurePlan.some((r) => r.status === "error")) return failed("La sostituzione renderebbe non valide vendite successive: includi i rendiconti successivi nel nuovo export");
    for (const doc of later) {
      const totals = new Map(quantities);
      for (const o of following.filter((o) => o.date <= doc.to)) {
        const q = Number(o.quantity); const old = totals.get(o.instrumentId) ?? 0;
        totals.set(o.instrumentId, o.type === "acquisto" || o.type === "rettifica" ? old + q : o.type === "vendita" || o.type === "rimborso" ? old - q : old);
      }
      const wanted = new Map(doc.statement.positions.map((p) => [`${p.symbol}:${p.currency}`, p.quantity]));
      for (const [id, q] of totals) {
        const symbol = symbolById.get(id);
        if ((!symbol && Math.abs(q) > 1e-8) || (symbol && Math.abs(q - (wanted.get(symbol) ?? 0)) > 1e-8)) return failed("Posizioni incompatibili con un rendiconto successivo: includilo nel nuovo export");
        if (symbol) wanted.delete(symbol);
      }
      if ([...wanted.values()].some((q) => Math.abs(q) > 1e-8)) return failed("Posizioni successive non riconciliate");
    }
    const counts = { new: rows.filter((r) => r.status === "new").length, duplicate: rows.filter((r) => r.status === "duplicate").length, error: 0 };
    if (input.dryRun) return { rows, counts, inserted: 0, instrumentsCreated: 0, replacement };
    if (!portfolio) [portfolio] = await tx.insert(investmentPortfolios).values({ userId, name: `Interactive Brokers · ${statement.account.slice(-4)}`, broker, taxRegime: "dichiarativo" }).returning();
    // No writes to financial data occur before all validations pass. Deletes and inserts share this transaction.
    if (overlapping.length) {
      await tx.delete(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.portfolioId, portfolio.id), gte(investmentTransactions.date, statement.from), lte(investmentTransactions.date, statement.to)));
      for (const doc of overlapping) for (const p of doc.statement.positions) {
        const id = [...symbolById].find(([, symbol]) => symbol === `${p.symbol}:${p.currency}`)?.[0];
        if (id) await tx.delete(userInstrumentPrices).where(and(eq(userInstrumentPrices.userId, userId), eq(userInstrumentPrices.instrumentId, id), eq(userInstrumentPrices.date, doc.to), eq(userInstrumentPrices.close, String(p.price))));
      }
      await tx.delete(brokerStatements).where(and(eq(brokerStatements.userId, userId), eq(brokerStatements.accountKey, accountKey), inArray(brokerStatements.id, overlapping.map((d) => d.id))));
    }
    const values = ops.filter((_, i) => rows[i].status === "new").map((o) => ({ userId, portfolioId: portfolio.id, instrumentId: o.instrumentId,
      ...toRowValues({ ...o, fees: o.fees * (fx.get(o.line) ?? 1), taxes: o.taxes * (fx.get(o.line) ?? 1) }, fx.get(o.line) ?? 1) }));
    for (let i = 0; i < values.length; i += 500) await tx.insert(investmentTransactions).values(values.slice(i, i + 500));
    let cashAccountId = portfolio.statementCashAccountId ?? previous?.cashAccountId ?? overlapping.find((d) => d.cashAccountId)?.cashAccountId ?? later.find((d) => d.cashAccountId)?.cashAccountId;
    const balance = ((statement.nav.find((r) => r.label === "Cash")?.value ?? 0) * (fx.get(-1) ?? 1)).toFixed(2);
    if (!cashAccountId) {
      const [cashAccount] = await tx.insert(accounts).values({ userId, name: `Interactive Brokers · liquidità …${statement.account.slice(-4)}`, type: "Liquidità broker", balance, icon: "landmark" }).returning();
      cashAccountId = cashAccount.id;
    } else if (!later.length) await tx.update(accounts).set({ balance, updatedAt: new Date() }).where(and(eq(accounts.id, cashAccountId), eq(accounts.userId, userId)));
    await tx.update(investmentPortfolios).set({ statementCashAccountId: cashAccountId }).where(and(eq(investmentPortfolios.id, portfolio.id), eq(investmentPortfolios.userId, userId)));
    await tx.insert(brokerStatements).values({ userId, portfolioId: portfolio.id, cashAccountId, accountKey, fingerprint, from: statement.from, to: statement.to, statement, records: parsed.records });
    // Broker closing prices provide a real historical valuation even when a provider has no symbol/history.
    for (const p of statement.positions) {
      const id = [...symbolById].find(([, symbol]) => symbol === `${p.symbol}:${p.currency}`)?.[0];
      if (id) await tx.insert(userInstrumentPrices).values({ userId, instrumentId: id, date: statement.to, close: String(p.price) }).onConflictDoUpdate({ target: [userInstrumentPrices.userId, userInstrumentPrices.instrumentId, userInstrumentPrices.date], set: { close: String(p.price) } });
    }
    return { rows, counts, inserted: values.length, instrumentsCreated, replacement };
  });
  if (!input.dryRun && result.inserted > 0) for (const instrument of byKey.values()) if (instrument) await deps.ensureHistory(instrument, statement.from);
  return result;
}
