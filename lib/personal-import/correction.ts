import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { instruments } from "@/lib/db/schema/investments";
import { db } from "@/lib/db/client";
import { personalImportJobs as jobs, personalImportReceipts as receipts } from "@/lib/db/schema/personal-imports";
import { confirmImport, type Preview } from "./confirm";
import { deletionPlan, deletePersonalImport } from "./delete";
import { unseal } from "./crypto";
import { ImportError } from "./contract";

/** Comparison only contains rows that will actually be replaced/inserted, in profile currency. */
export async function compareCorrection(userId: string, id: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).for("update");
    if (!job?.correctionOf || job.status !== "correction_ready" || !job.encryptedPreview || job.expiresAt < new Date()) throw new ImportError("Correzione non disponibile o scaduta");
    const original = await deletionPlan(tx, userId, job.correctionOf);
    if (original.token !== job.correctionToken) throw new ImportError("L’importazione originale è cambiata. Scarta questa analisi e avvia una nuova correzione.");
    const assets = original.trades.length ? await tx.select().from(instruments).where(inArray(instruments.id, original.trades.map(r => r.instrumentId))) : [];
    const preview: Preview = JSON.parse(unseal(job.encryptedPreview, userId));
    const removedKeys = new Set(original.job.importLedger?.receiptKeys);
    const retainedKeys = new Set((await tx.select().from(receipts).where(eq(receipts.formatId, job.formatId))).filter(r => !removedKeys.has(r.recordKey)).map(r => r.recordKey));
    const proposed = preview.records.filter(r => !retainedKeys.has(r.key)).flatMap(r => {
      const o = r.outcome;
      if (o.kind !== "cash" && o.kind !== "investment") return [];
      const amount = o.kind === "cash" ? o.amount : (o.type === "acquisto" ? -o.quantity * o.price : o.type === "vendita" ? o.quantity * o.price : o.grossAmount!) - o.fees - o.taxes;
      return [{ date: o.date, description: o.description, amount: Math.round(amount * r.rate! * 100) / 100, investment: o.kind === "investment" ? { type: o.type, quantity: o.quantity, price: o.price, fees: o.fees * r.rate!, taxes: o.taxes * r.rate!, currency: o.currency, grossAmount: o.grossAmount } : null }];
    });
    return { tradesBefore: original.trades.map(r => ({ date: r.date, description: assets.find(a => a.id === r.instrumentId)?.name ?? "", currency: assets.find(a => a.id === r.instrumentId)?.currency ?? preview.currency, grossAmount: r.grossAmount === null ? null : Number(r.grossAmount), type: r.type, quantity: Number(r.quantity), price: Number(r.price), fees: Number(r.fees), taxes: Number(r.taxes) })), currency: preview.currency, before: original.cash.map(r => ({ date: r.date, description: r.description, amount: Number(r.amount) })), after: proposed, investmentsBefore: original.trades.length, investmentsAfter: proposed.filter(r => r.investment).length };
  });
}

/** Delete and confirm share one transaction: any failure restores the original ledger and balance. */
export async function replaceImport(userId: string, id: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId))).for("update");
    if (!job?.correctionOf) throw new ImportError("Correzione non disponibile");
    if (job.status === "imported") return { inserted: 0, alreadyImported: true, skipped: 0 };
    if (job.status !== "correction_ready" || !job.correctionToken || job.expiresAt < new Date()) throw new ImportError("Correzione non disponibile o scaduta");
    await deletePersonalImport(userId, job.correctionOf, job.correctionToken, tx);
    await tx.update(jobs).set({ status: "ready" }).where(eq(jobs.id, id));
    return confirmImport(userId, id, {}, tx);
  }, { isolationLevel: "serializable" });
}

/** Cancellation never deletes a proposal that another tab has already accepted. */
export async function discardCorrection(userId: string, id: string) {
  return db.transaction(async tx => {
    const plan = await deletionPlan(tx, userId, id);
    if (!plan.job.correctionOf || plan.job.status === "imported") throw new ImportError("La correzione è già stata confermata o non è disponibile");
    return deletePersonalImport(userId, id, plan.token, tx);
  }, { isolationLevel: "serializable" });
}
