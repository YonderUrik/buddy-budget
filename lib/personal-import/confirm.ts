import { validateBitpandaSettlements } from "./validate-bitpanda";
import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalFormats as formats, personalImportJobs as jobs, personalImportReceipts as receipts, personalParsers as parsers } from "@/lib/db/schema/personal-imports";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { instruments, investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import { getUserCurrency, toRowValues } from "@/lib/investments/operations";
import { findOversoldTransaction } from "@/lib/calc/investments";
import { extractMerchantName } from "@/lib/categorization/merchant-name";
import { digest, seal, unseal } from "./crypto";
import { ImportError, readRawFile, validateOutcomes, type Outcome, type PersonalParser } from "./contract";
import { RAW_PARSER_VERSION } from "./jobs";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { buildRuleResolver } from "@/lib/categorization/resolve";
import { loadBankCategoryMapper } from "@/lib/categorization/load-bank-category-mapper";
import { logger, recordCategorizationAutoApplied } from "@/lib/observability";
export type PreviewRecord = { key: string; source: string[]; line?: number; outcome: Outcome; rate: number | null };
/** `parser`: solo lato server, per le analisi con righe da controllare il cui parser non è ancora salvato (vedi `confirmImport`). */
export type Preview = { headers: string[]; currency: string; records: PreviewRecord[]; parser?: PersonalParser };
export interface ConfirmOptions {
  /** Importa saltando le righe non riconosciute (scelta esplicita dell'utente su un lavoro in `review_failed`). */
  skipErrors?: boolean;
}
/** Le righe non riconosciute diventano escluse; il motivo resta leggibile. Pura, per poterla testare. */
export function skipErrorRecords(records: PreviewRecord[]): { records: PreviewRecord[]; skippedKeys: Set<string> } {
  const skippedKeys = new Set<string>();
  const next = records.map(r => {
    if (r.outcome.kind !== "error") return r;
    skippedKeys.add(r.key);
    return { ...r, outcome: { row: r.outcome.row, kind: "ignore" as const, reason: `Saltata: ${r.outcome.reason}`.slice(0, 300) } };
  });
  return { records: next, skippedKeys };
}
/**
 * Identity of a row's interpretation, to tell an already imported row from a reinterpreted one. The bank category is
 * left out: a format that starts reading it must not make every row imported before look reinterpreted.
 */
export function outcomeHash(outcome: Outcome) {
  const { row: _row, ...fields } = outcome;
  void _row;
  if ("bankCategory" in fields) delete fields.bankCategory;
  return digest(JSON.stringify(fields));
}
export async function confirmImport(userId: string, id: string, options: ConfirmOptions = {}) {
  const currency = await getUserCurrency(userId);
  // User rules win over the bank's category: a row a rule takes stays on the fallback and the rule categorises it
  // right after the import (`categorizeNewMovementsSafely`), with its own origin and hit count.
  const rules = await buildRuleResolver(userId);
  const now = new Date();
  const result = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).for("update");
    if (!job) throw new ImportError("Importazione non disponibile");
    if (job.status === "imported") return { inserted: 0, alreadyImported: true };
    if (job.brokerProvider && job.failureReport?.reason === "broker_validation_failed") throw new ImportError("L'AI ha analizzato il file, ma il controllo originale del broker richiede una riconciliazione. Il supporto riceverà il report; nessun movimento è stato aggiunto.");
    const allowed = options.skipErrors ? ["ready", "review_failed"] : ["ready"];
    if (!allowed.includes(job.status) || !job.encryptedPreview || job.expiresAt < new Date()) throw new ImportError("Anteprima non disponibile o scaduta");
    const stored: Preview = JSON.parse(unseal(job.encryptedPreview, userId));
    if (stored.records.every(r => r.source.length === 1)) {
      validateBitpandaSettlements(readRawFile(stored.records.map(r => r.source[0]).join("\n")), stored.records.map(r => r.outcome));
    }
    if (stored.currency !== currency) throw new ImportError("La valuta del profilo è cambiata: carica nuovamente il CSV");
    const { records, skippedKeys } = options.skipErrors ? skipErrorRecords(stored.records) : { records: stored.records, skippedKeys: new Set<string>() };
    const preview: Preview = { ...stored, records };
    validateOutcomes(preview.records.map(r => r.outcome), { headers: preview.headers, delimiter: ",", rows: preview.records.map(r => r.source) });
    if (preview.records.some(r => r.outcome.kind === "error")) throw new ImportError("Ci sono righe non riconosciute");
    if (options.skipErrors && !preview.records.some(r => r.outcome.kind === "cash" || r.outcome.kind === "investment")) throw new ImportError("Nessuna riga riconosciuta da importare: rianalizza il file o caricane uno corretto");
    const [format] = await tx.select().from(formats).where(and(eq(formats.id, job.formatId), eq(formats.userId, userId))).for("update");
    if (!format) throw new ImportError("Formato non disponibile");
    const prior = new Map((await tx.select().from(receipts).where(eq(receipts.formatId, format.id))).map(r => [r.recordKey, r.outcomeHash]));
    for (const r of preview.records) if (prior.has(r.key) && prior.get(r.key) !== outcomeHash(r.outcome)) throw new ImportError("Una riga già importata ha una nuova interpretazione: verifica lo storico prima di proseguire");
    // Le righe saltate non lasciano ricevuta: corrette e ricaricate, o lette da un formato rianalizzato, tornano nuove.
    const fresh = preview.records.filter(r => !prior.has(r.key) && !skippedKeys.has(r.key));
    const financial = fresh.filter(r => r.outcome.kind === "cash" || r.outcome.kind === "investment");
    if (job.brokerProvider && financial.length) {
      const [native] = await tx.select({ id: brokerStatements.id }).from(brokerStatements).where(and(eq(brokerStatements.userId, userId), job.brokerProvider === "generic" ? undefined : sql`coalesce(${brokerStatements.statement}->>'provider', 'interactive-brokers') = ${job.brokerProvider}`)).limit(1);
      const dates = financial.flatMap(r => r.outcome.kind === "cash" || r.outcome.kind === "investment" ? [r.outcome.date] : []).sort();
      const [untracked] = await tx.select({ id: investmentTransactions.id }).from(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), sql`${investmentTransactions.date} between ${dates[0]} and ${dates.at(-1)}`, sql`${investmentTransactions.portfolioId} not in (select portfolio_id from personal_formats where user_id = ${userId} and portfolio_id is not null)`)).limit(1);
      if (native || untracked) throw new ImportError("Analisi AI completata. Lo storico contiene importazioni precedenti da riconciliare: il supporto riceverà il report. Nessun movimento è stato aggiunto.");
    }
    if (financial.some(r => !r.rate || !Number.isFinite(r.rate) || r.rate <= 0)) throw new ImportError("Cambio storico non disponibile: ricarica il CSV più tardi");
    let portfolioId = format.portfolioId, accountId = format.accountId;
    if (financial.length && !accountId) {
      const [account] = await tx.insert(accounts).values({ userId, name: `${format.name} · CSV`, type: "conto", source: "manuale", balance: "0" }).returning(); accountId = account.id;
    }
    const trades = financial.filter((r): r is typeof r & { outcome: Extract<Outcome, { kind: "investment" }> } => r.outcome.kind === "investment");
    if (trades.length && !portfolioId) {
      const [portfolio] = await tx.insert(investmentPortfolios).values({ userId, name: `${format.name} · CSV`, broker: `personal:${format.id}`, taxRegime: "dichiarativo" }).returning(); portfolioId = portfolio.id;
    }
    const tradeValues: (typeof investmentTransactions.$inferInsert)[] = [];
    const instrumentCache = new Map<string, typeof instruments.$inferSelect>();
    for (const r of trades) {
      const o = r.outcome;
      const identityKey = JSON.stringify([o.isin ?? o.name, o.currency]);
      const cached = instrumentCache.get(identityKey);
      const [existing] = cached ? [cached] : await tx.select().from(instruments).where(and(eq(instruments.createdByUserId, userId), eq(instruments.currency, o.currency), o.isin ? eq(instruments.isin, o.isin) : and(sql`${instruments.isin} is null`, eq(instruments.name, o.name))));
      let instrument = existing;
      if (!instrument) [instrument] = await tx.insert(instruments).values({ createdByUserId: userId, name: o.name, isin: o.isin, type: o.instrumentType, currency: o.currency, priceMode: "manuale" }).returning();
      instrumentCache.set(identityKey, instrument);
      if (instrument.type !== o.instrumentType) throw new ImportError("Il tipo di uno strumento non coincide con lo storico");
      tradeValues.push({ id: randomUUID(), userId, portfolioId: portfolioId!, instrumentId: instrument.id, ...toRowValues({ ...o, fees: o.fees * r.rate!, taxes: o.taxes * r.rate!, note: o.description }, r.rate!) });
    }
    if (portfolioId && tradeValues.length) {
      const existing = await tx.select().from(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.portfolioId, portfolioId)));
      const combined = [...existing, ...tradeValues.map((r, i) => ({ ...r, id: `new-${i}`, fxRate: r.fxRate ?? "1", fees: r.fees ?? "0", taxes: r.taxes ?? "0", grossAmount: r.grossAmount ?? null, quantity: r.quantity ?? "0", price: r.price ?? "0" }))];
      if (findOversoldTransaction(combined)) throw new ImportError("Lo storico vende più quote di quelle possedute: aggiungi gli acquisti precedenti");
    }
    let categoryId: string | undefined;
    // Giroconti e movimenti di cassa delle operazioni sui titoli vanno nei trasferimenti dell'utente, se ne ha uno:
    // sono esclusi per intero e non hanno niente da decidere in Categorizza.
    let transferCategoryId: string | undefined;
    if (financial.length) {
      const [fallback] = await tx.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
      categoryId = fallback?.id;
      if (!categoryId) { const [created] = await tx.insert(categories).values({ userId, name: "Da categorizzare", type: "voluta", color: "red", icon: "help-circle", isFallback: true }).returning(); categoryId = created.id; }
      const [transfer] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.userId, userId), eq(categories.type, "trasferimento"), eq(categories.isFallback, false))).orderBy(categories.createdAt).limit(1);
      transferCategoryId = transfer?.id;
    }
    let deltaCents = 0;
    const cashValues: (typeof transactions.$inferInsert)[] = [];
    const bank = { carried: 0, learned: 0, name: 0, dictionary: 0 };
    const bankMapper = financial.some(r => r.outcome.kind === "cash" && r.outcome.bankCategory) ? await loadBankCategoryMapper(userId, tx) : null;
    for (const r of financial) {
      const o = r.outcome;
      if (o.kind !== "cash" && o.kind !== "investment") continue;
      const amount = o.kind === "cash" ? o.amount : (o.type === "acquisto" ? -o.quantity * o.price : o.type === "vendita" ? o.quantity * o.price : o.grossAmount!) - o.fees - o.taxes;
      const cents = Math.round(amount * r.rate! * 100);
      if (!Number.isSafeInteger(cents) || Math.abs(cents) >= 1e12) throw new ImportError("Importo fuori limite");
      deltaCents += cents;
      const excluded = o.kind === "investment" || o.transfer;
      // Nome pulito come nella sync della banca (il testo originale resta in rawDescription per le regole già scritte su di esso).
      const description = o.kind === "cash" && !o.transfer ? extractMerchantName({ rawText: o.description, counterpartyName: null }).name : o.description;
      const bankCategory = o.kind === "cash" ? o.bankCategory ?? null : null;
      // The bank's category, mapped to one of the user's, is applied without asking (`categorySource = banca`); the
      // row stays editable and lists under «Messe dall'app». Unmapped labels fall back to the usual flow.
      const signed = cents / 100;
      const byRule = rules.resolve({ description, amount: signed }) ?? rules.resolve({ description: o.description, amount: signed });
      const fromBank = !excluded && bankCategory && !byRule ? bankMapper?.map(bankCategory, signed) ?? null : null;
      if (bankCategory && !excluded) bank.carried += 1;
      if (fromBank) bank[fromBank.kind] += 1;
      cashValues.push({ id: randomUUID(), userId, accountId: accountId!, categoryId: excluded && transferCategoryId ? transferCategoryId : fromBank?.categoryId ?? categoryId!, description, rawDescription: o.description, bankCategory, ...(fromBank ? { categorySource: "banca" as const, categorizedAt: now } : {}), date: o.date, amount: signed.toFixed(2), excludedAmount: excluded ? signed.toFixed(2) : "0", source: "manuale", externalId: `personal:${format.id}:${r.key}` });
    }
    for (let i = 0; i < tradeValues.length; i += 500) await tx.insert(investmentTransactions).values(tradeValues.slice(i, i + 500));
    for (let i = 0; i < cashValues.length; i += 500) await tx.insert(transactions).values(cashValues.slice(i, i + 500));
    if (accountId && financial.length) await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${(deltaCents / 100).toFixed(2)}`, updatedAt: new Date() }).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
    for (let i = 0; i < fresh.length; i += 500) await tx.insert(receipts).values(fresh.slice(i, i + 500).map(r => ({ formatId: format.id, recordKey: r.key, outcomeHash: outcomeHash(r.outcome) })));
    await tx.update(formats).set({ accountId, portfolioId }).where(eq(formats.id, format.id));
    // Importare saltando le righe vuol dire accettare il formato: il parser diventa quello del formato per i file successivi.
    let parserId = job.parserId;
    if (!parserId && stored.parser) {
      const [version] = await tx.insert(parsers).values({ formatId: format.id, signature: RAW_PARSER_VERSION, encryptedParser: seal(JSON.stringify(stored.parser), userId), model: "accepted-with-skips" }).returning();
      parserId = version.id;
    }
    await tx.update(jobs).set({ status: "imported", error: null, parserId, notifiedAt: null, notifyAfter: new Date(), encryptedCsv: null, encryptedPreview: null, importLedger: { cashIds: cashValues.map(r => r.id!), tradeIds: tradeValues.map(r => r.id!), receiptKeys: fresh.map(r => r.key), skipped: skippedKeys.size, bankCategorized: bank.learned + bank.name + bank.dictionary } }).where(eq(jobs.id, id));
    return { inserted: financial.length, duplicates: preview.records.length - fresh.length - skippedKeys.size, skipped: skippedKeys.size, bankCategorized: bank.learned + bank.name + bank.dictionary, bank };
  });
  if ("bank" in result && result.bank && result.bank.carried > 0) {
    const { carried, learned, name, dictionary } = result.bank;
    recordCategorizationAutoApplied("banca", learned + name + dictionary);
    logger.info("categorization.bank.mapped", { jobId: id, bankCategories: carried, bankLearned: learned, bankByName: name, bankByDictionary: dictionary, bankUnmapped: carried - learned - name - dictionary });
  }
  return result;
}
