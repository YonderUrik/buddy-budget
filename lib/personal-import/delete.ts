import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalFormats as formats, personalImportJobs as jobs, personalImportReceipts as receipts } from "@/lib/db/schema/personal-imports";
import { transactions } from "@/lib/db/schema/transactions";
import { investmentTransactions } from "@/lib/db/schema/investments";
import { accounts } from "@/lib/db/schema/accounts";
import { findOversoldTransaction } from "@/lib/calc/investments";
import { digest } from "./crypto";
import { ImportError } from "./contract";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function deletionPlan(tx: Tx, userId: string, id: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 81234)`);
  const [job] = await tx.select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.id, id))).for("update");
  if (!job) throw new ImportError("Importazione non disponibile");
  const [format] = await tx.select().from(formats).where(and(eq(formats.userId, userId), eq(formats.id, job.formatId))).for("update");
  if (!format) throw new ImportError("Formato non disponibile");
  if (job.status === "imported" && !job.importLedger) throw new ImportError("Metadati dell’importazione non disponibili");
  const affected = [job];
  const cash = job.importLedger?.cashIds.length ? await tx.select().from(transactions).where(and(eq(transactions.userId, userId), inArray(transactions.id, job.importLedger.cashIds))).orderBy(transactions.id).for("update") : [];
  const trades = job.importLedger?.tradeIds.length ? await tx.select().from(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), inArray(investmentTransactions.id, job.importLedger.tradeIds))).orderBy(investmentTransactions.id).for("update") : [];
  const token = digest(JSON.stringify({ jobs: affected.map(j => [j.id, j.status, j.importLedger]), cash, trades }));
  return { job, format, cash, trades, affected, token };
}
function summary(plan: Awaited<ReturnType<typeof deletionPlan>>) {
  return { token: plan.token, name: plan.format.name, cashCount: plan.cash.length, investmentCount: plan.trades.length, uploads: plan.affected.map(j => ({ id: j.id, createdAt: j.createdAt })) };
}
export async function previewPersonalImportDeletion(userId: string, id: string) {
  return db.transaction(async tx => summary(await deletionPlan(tx, userId, id)));
}
export async function deletePersonalImport(userId: string, id: string, token: string) {
  return db.transaction(async tx => {
    const plan = await deletionPlan(tx, userId, id);
    if (token !== plan.token) throw new ImportError("L’importazione è cambiata. Chiudi e riapri la conferma per verificare i dati aggiornati.");
    const removed = new Set(plan.trades.map(r => r.id));
    const portfolioIds = [...new Set(plan.trades.map(r => r.portfolioId))];
    if (portfolioIds.length) {
      const remaining = (await tx.select().from(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), inArray(investmentTransactions.portfolioId, portfolioIds))).for("update")).filter(r => !removed.has(r.id));
      if (portfolioIds.some(portfolioId => findOversoldTransaction(remaining.filter(r => r.portfolioId === portfolioId)))) throw new ImportError("Altre operazioni vendono quote acquistate con questo import. Elimina prima le importazioni o le vendite che dipendono da questi acquisti.");
    }
    // Use the current account and amount, including any edits made after import.
    const deltas = new Map<string, number>();
    for (const row of plan.cash) deltas.set(row.accountId, (deltas.get(row.accountId) ?? 0) + Math.round(Number(row.amount) * 100));
    for (const [accountId, cents] of deltas) await tx.update(accounts).set({ balance: sql`${accounts.balance} - ${(cents / 100).toFixed(2)}`, updatedAt: new Date() }).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)));
    if (plan.cash.length) await tx.delete(transactions).where(and(eq(transactions.userId, userId), inArray(transactions.id, plan.cash.map(r => r.id))));
    if (plan.trades.length) await tx.delete(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), inArray(investmentTransactions.id, [...removed])));
    if (plan.job.importLedger?.receiptKeys.length) await tx.delete(receipts).where(and(eq(receipts.formatId, plan.format.id), inArray(receipts.recordKey, plan.job.importLedger.receiptKeys)));
    await tx.delete(jobs).where(and(eq(jobs.userId, userId), inArray(jobs.id, plan.affected.map(j => j.id))));
    return summary(plan);
  }, { isolationLevel: "serializable" });
}
