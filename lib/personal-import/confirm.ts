import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalFormats as formats, personalImportJobs as jobs, personalImportReceipts as receipts } from "@/lib/db/schema/personal-imports";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { instruments, investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import { getUserCurrency, toRowValues } from "@/lib/investments/operations";
import { findOversoldTransaction } from "@/lib/calc/investments";
import { digest, unseal } from "./crypto";
import { ImportError, validateOutcomes, type Outcome } from "./contract";
export type Preview = { headers: string[]; currency: string; records: { key: string; source: string[]; outcome: Outcome; rate: number | null }[] };
export function outcomeHash(outcome: Outcome) {
  const { row: _row, ...fields } = outcome;
  void _row;
  return digest(JSON.stringify(fields));
}
export async function confirmImport(userId: string, id: string) {
  const currency = await getUserCurrency(userId);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).for("update");
    if (!job) throw new ImportError("Importazione non disponibile");
    if (job.status === "imported") return { inserted: 0, alreadyImported: true };
    if (job.status !== "ready" || !job.encryptedPreview || job.expiresAt < new Date()) throw new ImportError("Anteprima non disponibile o scaduta");
    const preview: Preview = JSON.parse(unseal(job.encryptedPreview, userId));
    if (preview.currency !== currency) throw new ImportError("La valuta del profilo è cambiata: carica nuovamente il CSV");
    validateOutcomes(preview.records.map(r => r.outcome), { headers: preview.headers, delimiter: ",", rows: preview.records.map(r => r.source) });
    if (preview.records.some(r => r.outcome.kind === "error")) throw new ImportError("Ci sono righe non riconosciute");
    const [format] = await tx.select().from(formats).where(and(eq(formats.id, job.formatId), eq(formats.userId, userId))).for("update");
    if (!format) throw new ImportError("Formato non disponibile");
    const prior = new Map((await tx.select().from(receipts).where(eq(receipts.formatId, format.id))).map(r => [r.recordKey, r.outcomeHash]));
    for (const r of preview.records) if (prior.has(r.key) && prior.get(r.key) !== outcomeHash(r.outcome)) throw new ImportError("Una riga già importata ha una nuova interpretazione: verifica lo storico prima di proseguire");
    const fresh = preview.records.filter(r => !prior.has(r.key));
    const financial = fresh.filter(r => r.outcome.kind === "cash" || r.outcome.kind === "investment");
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
    if (financial.length) {
      const [fallback] = await tx.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.isFallback, true)));
      categoryId = fallback?.id;
      if (!categoryId) { const [created] = await tx.insert(categories).values({ userId, name: "Da categorizzare", type: "voluta", color: "red", icon: "help-circle", isFallback: true }).returning(); categoryId = created.id; }
    }
    let deltaCents = 0;
    const cashValues: (typeof transactions.$inferInsert)[] = [];
    for (const r of financial) {
      const o = r.outcome;
      if (o.kind !== "cash" && o.kind !== "investment") continue;
      const amount = o.kind === "cash" ? o.amount : (o.type === "acquisto" ? -o.quantity * o.price : o.type === "vendita" ? o.quantity * o.price : o.grossAmount!) - o.fees - o.taxes;
      const cents = Math.round(amount * r.rate! * 100);
      if (!Number.isSafeInteger(cents) || Math.abs(cents) >= 1e12) throw new ImportError("Importo fuori limite");
      deltaCents += cents;
      cashValues.push({ id: randomUUID(), userId, accountId: accountId!, categoryId: categoryId!, description: o.description, date: o.date, amount: (cents / 100).toFixed(2), excludedAmount: o.kind === "investment" || o.transfer ? (cents / 100).toFixed(2) : "0", source: "manuale", externalId: `personal:${format.id}:${r.key}` });
    }
    for (let i = 0; i < tradeValues.length; i += 500) await tx.insert(investmentTransactions).values(tradeValues.slice(i, i + 500));
    for (let i = 0; i < cashValues.length; i += 500) await tx.insert(transactions).values(cashValues.slice(i, i + 500));
    if (accountId && financial.length) await tx.update(accounts).set({ balance: sql`${accounts.balance} + ${(deltaCents / 100).toFixed(2)}`, updatedAt: new Date() }).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
    for (let i = 0; i < fresh.length; i += 500) await tx.insert(receipts).values(fresh.slice(i, i + 500).map(r => ({ formatId: format.id, recordKey: r.key, outcomeHash: outcomeHash(r.outcome) })));
    await tx.update(formats).set({ accountId, portfolioId }).where(eq(formats.id, format.id));
    await tx.update(jobs).set({ status: "imported", encryptedCsv: null, encryptedPreview: null, importLedger: { cashIds: cashValues.map(r => r.id!), tradeIds: tradeValues.map(r => r.id!), receiptKeys: fresh.map(r => r.key) } }).where(eq(jobs.id, id));
    return { inserted: financial.length, duplicates: preview.records.length - fresh.length };
  });
}
