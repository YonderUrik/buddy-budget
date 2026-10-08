import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, lte, inArray, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { personalImportJobs as jobs, personalParsers as parsers } from "@/lib/db/schema/personal-imports";
import { logger } from "@/lib/observability";
import { readTable, parserSchema } from "./contract";
import { seal, unseal, digest } from "./crypto";
import { signatureOf } from "./jobs";
import { executeParser } from "./sandbox";
import { getUserCurrency, todayKey } from "@/lib/investments/operations";
import { resolveFxRates } from "@/lib/investments/import/execute";
import { updateFxRates } from "@/lib/market-data/update";
import { marketDataDeps } from "@/lib/market-data/runtime";
import { generateParser, ModelInputError } from "./generate";

export async function processOne() {
  const lease = randomUUID();
  const job = await db.transaction(async tx => {
    const [candidate] = await tx.select().from(jobs).where(sql`(${jobs.status} = 'queued' AND ${jobs.availableAt} <= now() OR ${jobs.status} = 'processing' AND ${jobs.leaseUntil} < now()) AND ${jobs.expiresAt} > now()`).orderBy(jobs.createdAt).limit(1).for("update", { skipLocked: true });
    if (!candidate) return null;
    const [claimed] = await tx.update(jobs).set({ status: "processing", error: null, lease, leaseUntil: new Date(Date.now() + 5 * 60000), attempts: candidate.attempts + 1 }).where(eq(jobs.id, candidate.id)).returning();
    return claimed;
  });
  if (!job) return false;
  const owned = and(eq(jobs.id, job.id), eq(jobs.lease, lease), eq(jobs.status, "processing"));
  logger.info("personal_import.started", { jobId: job.id });
  let phase = "read";
  try {
    if (job.attempts > 3 || !job.encryptedCsv) throw new Error("Tentativi esauriti");
    const table = readTable(unseal(job.encryptedCsv, job.userId));
    const [saved] = job.parserId ? await db.select().from(parsers).where(and(eq(parsers.id, job.parserId), eq(parsers.formatId, job.formatId))) : [];
    phase = "generate";
    const generated = saved ? { parser: parserSchema.parse(JSON.parse(unseal(saved.encryptedParser, job.userId))), model: saved.model } : await generateParser(table);
    phase = "execute";
    const outcomes = await executeParser(generated.parser, table);
    const repeated = await executeParser(generated.parser, table);
    if (JSON.stringify(outcomes) !== JSON.stringify(repeated)) throw new Error("Parser non deterministico");
    phase = "fx";
    const currency = await getUserCurrency(job.userId);
    const fx = await resolveFxRates(outcomes.flatMap(o => o.kind === "cash" || o.kind === "investment" ? [{ line: o.row, date: o.date, currency: o.currency }] : []), {
      userCurrency: currency, todayKey: todayKey(), createInstrument: async () => { throw new Error("unused"); }, ensureHistory: async () => {},
      fetchFx: async (currencies, from, to) => { await updateFxRates(currencies.filter(c => c !== "EUR"), from, to, marketDataDeps()); },
    });
    if ([...fx.values()].some(rate => rate === null || !Number.isFinite(rate) || rate <= 0)) throw new Error("Cambio storico non disponibile");
    const occurrences = new Map<string, number>();
    const records = table.rows.map((row, i) => { const hash = digest(JSON.stringify(row)); const n = (occurrences.get(hash) ?? 0) + 1; occurrences.set(hash, n); return { key: `${hash}:${n}`, source: row, outcome: outcomes[i], rate: fx.get(i) ?? null }; });
    const errors = outcomes.filter(o => o.kind === "error");
    phase = "persist";
    await db.transaction(async tx => {
      const [current] = await tx.select().from(jobs).where(owned).for("update");
      if (!current) return;
      let parserId = saved?.id;
      if (!errors.length && !parserId) {
        const [version] = await tx.insert(parsers).values({ formatId: job.formatId, signature: signatureOf(table), encryptedParser: seal(JSON.stringify(generated.parser), job.userId), model: generated.model }).returning(); parserId = version.id;
      }
      await tx.update(jobs).set({ status: errors.length ? "review_failed" : "ready", parserId, encryptedCsv: null, encryptedPreview: seal(JSON.stringify({ headers: table.headers, currency, records }), job.userId), error: errors.length ? "Alcune righe richiedono verifica. Correggi il file o rigenera il formato." : null, lease: null, leaseUntil: null }).where(owned);
    });
    logger.info("personal_import.completed", { jobId: job.id, count: outcomes.length, rejected: errors.length });
  } catch (error) {
    const terminal = job.attempts >= 3 || error instanceof ModelInputError;
    await db.update(jobs).set({ status: terminal ? "failed" : "queued", error: error instanceof ModelInputError ? error.message : "Analisi non riuscita. Verifica il CSV e riprova; nessun movimento è stato importato.", availableAt: new Date(Date.now() + job.attempts * 60000), encryptedCsv: terminal ? null : job.encryptedCsv, lease: null, leaseUntil: null }).where(owned);
    logger.warn("personal_import.failed", { jobId: job.id, reason: "analysis_failed", phase });
  }
  return true;
}

export async function maintainJobs() {
  await db.update(jobs).set({ encryptedCsv: null, encryptedPreview: null, status: "expired", lease: null, leaseUntil: null }).where(and(lte(jobs.expiresAt, new Date()), sql`${jobs.status} not in ('imported', 'expired')`));
  // Atomic notification claim; independent retries never rerun the parser or import financial data.
  const pending = await db.transaction(async tx => {
    const [job] = await tx.select().from(jobs).where(and(inArray(jobs.status, ["ready", "review_failed", "failed"]), sql`${jobs.notifiedAt} is null`, lte(jobs.notifyAfter, new Date()))).limit(1).for("update", { skipLocked: true });
    if (!job) return null;
    await tx.update(jobs).set({ notifyAfter: new Date(Date.now() + 15 * 60000) }).where(eq(jobs.id, job.id));
    return job;
  });
  if (!pending) return;
  try {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM || !process.env.APP_URL) throw new Error("Email non configurata");
    const [user] = await db.select({ email: authUser.email }).from(authUser).where(eq(authUser.id, pending.userId));
    if (!user) return;
    const url = new URL(`/importazioni?job=${pending.id}`, process.env.APP_URL).toString();
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.RESEND_FROM, to: user.email, subject: pending.status === "ready" ? "Il tuo CSV è pronto da verificare" : "Il tuo CSV richiede una verifica", text: `L'analisi del tuo CSV è terminata. Apri BuddyBudget per controllare il risultato: ${url}\nNessun movimento viene importato senza la tua conferma.` }, { idempotencyKey: `personal-csv-${pending.id}` });
    if (result.error) throw new Error("Invio fallito");
    await db.update(jobs).set({ notifiedAt: new Date() }).where(eq(jobs.id, pending.id));
  } catch { logger.warn("personal_import.email_failed", { jobId: pending.id, reason: "delivery_failed" }); }
}
