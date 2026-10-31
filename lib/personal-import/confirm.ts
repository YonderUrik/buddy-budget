import { validateBitpandaSettlements } from "./validate-bitpanda";
import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalFormats as formats, personalImportJobs as jobs, personalImportReceipts as receipts } from "@/lib/db/schema/personal-imports";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { instruments, investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import { getUserCurrency, toRowValues } from "@/lib/investments/operations";
import { findOversoldTransaction } from "@/lib/calc/investments";
import { extractMerchantName } from "@/lib/categorization/merchant-name";
import { digest, unseal } from "./crypto";
import { existingCashKey, existingTradeKey, presentByContent } from "./content-match";
import { ImportError, readRawFile, validateOutcomes, type Outcome } from "./contract";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { buildRuleResolver } from "@/lib/categorization/resolve";
import { loadBankCategoryMapper } from "@/lib/categorization/load-bank-category-mapper";
import { logger, recordCategorizationAutoApplied } from "@/lib/observability";
export type PreviewRecord = { key: string; source: string[]; line?: number; outcome: Outcome; rate: number | null };
export type Preview = { headers: string[]; currency: string; records: PreviewRecord[] };
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
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Keys among `keys` already imported under another of the user's sources, with the source that holds each. */
async function importedElsewhere(tx: Tx, userId: string, formatId: string, keys: string[]) {
  const found = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 1000) {
    const rows = await tx.select({ key: receipts.recordKey, formatId: receipts.formatId }).from(receipts).innerJoin(formats, eq(formats.id, receipts.formatId))
      .where(and(eq(formats.userId, userId), ne(receipts.formatId, formatId), inArray(receipts.recordKey, keys.slice(i, i + 1000))));
    for (const r of rows) found.set(r.key, r.formatId);
  }
  return found;
}
/**
 * Portfolios that can hold the native history of `provider`: the statement readers' own (`ibkr:`, `degiro:`,
 * `trade-republic:` and the direct Trade Republic connection), the default portfolio for the mapped exports (Fineco,
 * Yahoo). An unknown broker keeps the broad check: any portfolio not from a personal import.
 */
function sameBrokerPortfolios(provider: string) {
  const broker = investmentPortfolios.broker;
  switch (provider) {
    case "interactive-brokers": return sql`${broker} like 'ibkr:%'`;
    case "degiro": return sql`${broker} like 'degiro:%'`;
    case "trade-republic": return sql`(${broker} like 'trade-republic:%' or ${broker} like 'trade-republic-api:%')`;
    case "fineco": case "yahoo-portfolio": return sql`${broker} is null`;
    default: return undefined;
  }
}
/** Line keys of `candidates` whose exact content is already stored in the source's account or portfolio. */
async function storedByContent(tx: Tx, userId: string, accountId: string | null, portfolioId: string | null, file: PreviewRecord[], candidates: PreviewRecord[]) {
  const dates = candidates.flatMap(r => r.outcome.kind === "cash" || r.outcome.kind === "investment" ? [r.outcome.date] : []).sort();
  if (!dates.length || (!accountId && !portfolioId)) return new Set<string>();
  const [from, to] = [dates[0], dates.at(-1)!];
  const cash = accountId ? await tx.select({ date: transactions.date, amount: transactions.amount, raw: transactions.rawDescription, description: transactions.description }).from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.accountId, accountId), sql`${transactions.date} between ${from} and ${to}`)) : [];
  const trades = portfolioId ? await tx.select({ date: investmentTransactions.date, type: investmentTransactions.type, quantity: investmentTransactions.quantity, price: investmentTransactions.price, grossAmount: investmentTransactions.grossAmount, isin: instruments.isin, name: instruments.name })
    .from(investmentTransactions).innerJoin(instruments, eq(instruments.id, investmentTransactions.instrumentId))
    .where(and(eq(investmentTransactions.userId, userId), eq(investmentTransactions.portfolioId, portfolioId), sql`${investmentTransactions.date} between ${from} and ${to}`)) : [];
  // The cash leg of an imported trade is stored too, fully excluded: it is matched through the trade, not on its own.
  const stored = [...cash.map(r => existingCashKey({ date: r.date, amount: r.amount, description: r.raw ?? r.description })), ...trades.map(existingTradeKey)];
  return presentByContent(file, candidates, stored);
}
export async function confirmImport(userId: string, id: string) {
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
    if (job.status !== "ready" || !job.encryptedPreview || job.expiresAt < new Date()) throw new ImportError("Anteprima non disponibile o scaduta");
    const preview: Preview = JSON.parse(unseal(job.encryptedPreview, userId));
    if (preview.records.every(r => r.source.length === 1)) {
      validateBitpandaSettlements(readRawFile(preview.records.map(r => r.source[0]).join("\n")), preview.records.map(r => r.outcome));
    }
    if (preview.currency !== currency) throw new ImportError("La valuta del profilo è cambiata: carica nuovamente il CSV");
    validateOutcomes(preview.records.map(r => r.outcome), { headers: preview.headers, delimiter: ",", rows: preview.records.map(r => r.source) });
    if (preview.records.some(r => r.outcome.kind === "error")) throw new ImportError("Ci sono righe non riconosciute");
    const [format] = await tx.select().from(formats).where(and(eq(formats.id, job.formatId), eq(formats.userId, userId))).for("update");
    if (!format) throw new ImportError("Formato non disponibile");
    const prior = new Set((await tx.select({ key: receipts.recordKey }).from(receipts).where(eq(receipts.formatId, format.id))).map(r => r.key));
    // A row's key is its raw content, the same whatever format read it: a row already imported under another of the
    // user's sources (the same bank chosen again as a new one) is a duplicate too. It leaves no receipt here, so
    // deleting the original import makes it new again. A line already imported stays present even when a newer
    // parser reads it differently: the stored movement wins, nothing is blocked.
    const elsewhere = await importedElsewhere(tx, userId, format.id, preview.records.filter(r => !prior.has(r.key)).map(r => r.key));
    const newLines = preview.records.filter(r => !prior.has(r.key) && !elsewhere.has(r.key));
    let portfolioId = format.portfolioId, accountId = format.accountId;
    // A new source whose file overlaps one already imported adds its new rows to that source's account and portfolio,
    // not to a second copy of the same account.
    const origins = new Set(elsewhere.values());
    if (origins.size === 1 && !accountId && !portfolioId) {
      const [origin] = await tx.select({ accountId: formats.accountId, portfolioId: formats.portfolioId }).from(formats).where(and(eq(formats.id, [...origins][0]), eq(formats.userId, userId)));
      accountId = origin?.accountId ?? null; portfolioId = origin?.portfolioId ?? null;
    }
    // New lines whose exact content is already in this source's account or portfolio: the bank changed its layout.
    const sameContent = await storedByContent(tx, userId, accountId, portfolioId, preview.records, newLines);
    const fresh = newLines.filter(r => !sameContent.has(r.key));
    const financial = fresh.filter(r => r.outcome.kind === "cash" || r.outcome.kind === "investment");
    const fileRows = preview.records.filter(r => r.outcome.kind === "cash" || r.outcome.kind === "investment").length;
    const alreadyPresent = fileRows - financial.length;
    if (job.brokerProvider && financial.length) {
      const [native] = await tx.select({ id: brokerStatements.id }).from(brokerStatements).where(and(eq(brokerStatements.userId, userId), job.brokerProvider === "generic" ? undefined : sql`coalesce(${brokerStatements.statement}->>'provider', 'interactive-brokers') = ${job.brokerProvider}`)).limit(1);
      const dates = financial.flatMap(r => r.outcome.kind === "cash" || r.outcome.kind === "investment" ? [r.outcome.date] : []).sort();
      // Only that broker's own history can hold the same trades: another broker's portfolio (a Trade Republic
      // connection next to an IBKR file) is not an overlap.
      const [untracked] = await tx.select({ id: investmentTransactions.id }).from(investmentTransactions).innerJoin(investmentPortfolios, eq(investmentPortfolios.id, investmentTransactions.portfolioId)).where(and(eq(investmentTransactions.userId, userId), sql`${investmentTransactions.date} between ${dates[0]} and ${dates.at(-1)}`, sql`${investmentTransactions.portfolioId} not in (select portfolio_id from personal_formats where user_id = ${userId} and portfolio_id is not null)`, sameBrokerPortfolios(job.brokerProvider))).limit(1);
      if (native || untracked) throw new ImportError("Analisi AI completata. Lo storico contiene importazioni precedenti da riconciliare: il supporto riceverà il report. Nessun movimento è stato aggiunto.");
    }
    if (financial.some(r => !r.rate || !Number.isFinite(r.rate) || r.rate <= 0)) throw new ImportError("Cambio storico non disponibile: ricarica il CSV più tardi");
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
    await tx.update(jobs).set({ status: "imported", error: null, notifiedAt: null, notifyAfter: new Date(), encryptedCsv: null, encryptedPreview: null, importLedger: { cashIds: cashValues.map(r => r.id!), tradeIds: tradeValues.map(r => r.id!), receiptKeys: fresh.map(r => r.key), bankCategorized: bank.learned + bank.name + bank.dictionary, rows: fileRows, alreadyPresent } }).where(eq(jobs.id, id));
    return { inserted: financial.length, duplicates: preview.records.length - fresh.length, rows: fileRows, alreadyPresent, bankCategorized: bank.learned + bank.name + bank.dictionary, bank };
  });
  if ("bank" in result && result.bank && result.bank.carried > 0) {
    const { carried, learned, name, dictionary } = result.bank;
    recordCategorizationAutoApplied("banca", learned + name + dictionary);
    logger.info("categorization.bank.mapped", { jobId: id, bankCategories: carried, bankLearned: learned, bankByName: name, bankByDictionary: dictionary, bankUnmapped: carried - learned - name - dictionary });
  }
  return result;
}
