import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalFormats as formats, personalParsers as parsers, personalImportJobs as jobs } from "@/lib/db/schema/personal-imports";
import { seal, unseal } from "./crypto";
import { ImportError, readRawFile } from "./contract";
import type { Preview } from "./confirm";
// Raw-file parsers are selected only within the source explicitly chosen by this user.
export const RAW_PARSER_VERSION = "raw-csv-v1";
export async function enqueue(userId: string, input: { csv: string; name: string; formatId?: string; regenerate?: boolean }) {
  readRawFile(input.csv);
  const signature = RAW_PARSER_VERSION;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 81234)`);
    const recent = await tx.select({ status: jobs.status }).from(jobs).where(and(eq(jobs.userId, userId), gte(jobs.createdAt, new Date(Date.now() - 86400000))));
    if (recent.length >= 10 || recent.filter(j => ["queued", "processing"].includes(j.status)).length >= 2) throw new ImportError("Limite raggiunto: massimo 2 analisi in corso e 10 caricamenti al giorno");
    let format = input.formatId ? (await tx.select().from(formats).where(and(eq(formats.id, input.formatId), eq(formats.userId, userId))))[0] : undefined;
    if (input.formatId && !format) throw new ImportError("Formato non disponibile");
    if (!format) [format] = await tx.insert(formats).values({ userId, name: input.name }).returning();
    const [parser] = input.regenerate ? [] : await tx.select().from(parsers).where(and(eq(parsers.formatId, format.id), eq(parsers.signature, signature))).orderBy(desc(parsers.createdAt)).limit(1);
    const [job] = await tx.insert(jobs).values({ userId, consentVersion: "openrouter-raw-zdr-v2", formatId: format.id, parserId: parser?.id, encryptedCsv: seal(input.csv, userId), estimatedAt: new Date(Date.now() + 3600000), expiresAt: new Date(Date.now() + 7 * 86400000) }).returning({ id: jobs.id });
    return job;
  });
}
export async function listImports(userId: string) {
  const [sources, requests] = await Promise.all([
    db.select({ id: formats.id, name: formats.name }).from(formats).where(eq(formats.userId, userId)).orderBy(desc(formats.createdAt)),
    db.select({ id: jobs.id, formatId: jobs.formatId, status: jobs.status, estimatedAt: jobs.estimatedAt, expiresAt: jobs.expiresAt, createdAt: jobs.createdAt, error: jobs.error, notifiedAt: jobs.notifiedAt, ledger: jobs.importLedger }).from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt)),
  ]);
  // Del registro dell'importazione esce solo il conteggio (movimenti e operazioni creati), mai gli id.
  return { formats: sources, jobs: requests.map(({ ledger, ...job }) => ({ ...job, results: ledger ? { cash: ledger.cashIds.length, investments: ledger.tradeIds.length, skipped: ledger.skipped ?? 0 } : null })) };
}
/** Anteprima per il client: il parser generato (se presente) resta sul server. */
export async function getPreview(userId: string, id: string): Promise<Omit<Preview, "parser"> | null> {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
  if (!job || !job.encryptedPreview || job.expiresAt < new Date()) return null;
  const { parser: _parser, ...preview }: Preview = JSON.parse(unseal(job.encryptedPreview, userId));
  void _parser;
  return preview;
}
/**
 * Rianalizza con l'AI un file con righe da controllare, senza ricaricarlo: il testo si ricostruisce dalle righe
 * dell'anteprima (una per riga fisica), il lavoro vecchio viene tolto dalla lista e ne parte uno nuovo con
 * «rileggi il formato». Stesso consenso del primo caricamento, richiesto di nuovo dalla route.
 */
export async function reanalyze(userId: string, id: string) {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
  if (!job || job.status !== "review_failed" || !job.encryptedPreview || job.expiresAt < new Date()) throw new ImportError("Rianalisi non disponibile: carica di nuovo il file");
  const preview: Preview = JSON.parse(unseal(job.encryptedPreview, userId));
  if (preview.records.some(r => r.source.length !== 1)) throw new ImportError("Rianalisi non disponibile: carica di nuovo il file");
  const [format] = await db.select({ name: formats.name }).from(formats).where(and(eq(formats.id, job.formatId), eq(formats.userId, userId)));
  if (!format) throw new ImportError("Formato non disponibile");
  const next = await enqueue(userId, { csv: preview.records.map(r => r.source[0]).join("\n"), name: format.name, formatId: job.formatId, regenerate: true });
  await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId), eq(jobs.status, "review_failed")));
  return next;
}
