import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { personalFormats as formats, personalParsers as parsers, personalImportJobs as jobs } from "@/lib/db/schema/personal-imports";
import { seal, unseal, digest } from "./crypto";
import { brokerFallbackSource } from "./broker-fallback";
import { ImportError, readRawFile } from "./contract";
import type { Preview } from "./confirm";
import { instanceCapabilities } from "@/lib/selfhost";
import { isSelfHosted } from "@/lib/instance/config";
import { importCounts } from "./counts";
import { analysisProgress } from "./progress";
// Raw-file parsers are selected only within the source explicitly chosen by this user.
export const RAW_PARSER_VERSION = "raw-csv-v1";
/** Shown when the exact same file was already imported: nothing is analysed or saved again. */
export const ALREADY_IMPORTED_MESSAGE = "Questo file è già stato importato: i suoi movimenti ci sono già tutti.";
/**
 * The only error a user sees after every automatic attempt failed. The hosted service sends support a report on its
 * own; a self-hosted install has no project support, so it points to the worker log instead.
 */
export function importFailedMessage() {
  return isSelfHosted()
    ? "Non siamo riusciti a leggere questo file: nessun movimento è stato salvato. Il dettaglio è nel log del worker CSV."
    : "Non siamo riusciti a leggere questo file: nessun movimento è stato salvato. Il team è già stato avvisato: se vuoi una mano, scrivi al supporto.";
}
/** Identity of an uploaded file, the same whatever the line endings, BOM or trailing blank lines. */
/** Files one user may have waiting or in analysis at once: a batch of exports of the same bank. */
export const MAX_ACTIVE_JOBS = 10;
/** Uploads per user in 24 hours. */
export const MAX_DAILY_UPLOADS = 30;
const ACTIVE_STATUSES = ["queued", "processing", "ready"];
const LIMIT_MESSAGE = "Limite raggiunto: massimo 10 file in analisi e 30 caricamenti al giorno";
export function fileFingerprint(csv: string) {
  return digest(csv.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\s+$/, ""));
}
export async function enqueue(userId: string, input: { csv: string; name: string; formatId?: string; regenerate?: boolean; brokerFallback?: boolean }) {
  if (process.env.SELF_HOSTED === "true" && !instanceCapabilities().aiCsv) throw new ImportError("Importazione personalizzata non ancora configurata");
  readRawFile(input.csv);
  const broker = input.brokerFallback ? brokerFallbackSource(input.csv) : null;
  // Every upload carries its fingerprint, whatever source the user picked: the same file chosen again as a «new bank»
  // would otherwise be read with a fresh format and no receipts, and every movement would enter twice.
  const sourceFingerprint = fileFingerprint(input.csv);
  const signature = RAW_PARSER_VERSION;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 81234)`);
    if (!input.regenerate) {
      // A file already imported is refused before any analysis; a broker file still on its way returns its own job.
      const same = await tx.select({ id: jobs.id, status: jobs.status, formatId: jobs.formatId }).from(jobs).where(and(eq(jobs.userId, userId), sql`${jobs.sourceFingerprint} in (${sourceFingerprint}, ${digest(input.csv)})`, sql`${jobs.status} not in ('failed', 'expired')`));
      if (same.some(j => j.status === "imported")) throw new ImportError(ALREADY_IMPORTED_MESSAGE, "already_imported");
      // The same file sent again while it is still on its way (a double drop, a retried batch) is that job.
      const pending = same.find(j => ACTIVE_STATUSES.includes(j.status));
      if (pending) return pending;
    }
    const recent = await tx.select({ status: jobs.status }).from(jobs).where(and(eq(jobs.userId, userId), gte(jobs.createdAt, new Date(Date.now() - 86400000))));
    if (recent.length >= MAX_DAILY_UPLOADS || recent.filter(j => ["queued", "processing"].includes(j.status)).length >= MAX_ACTIVE_JOBS) throw new ImportError(LIMIT_MESSAGE);
    const [priorBroker] = broker && broker.provider !== "generic" ? await tx.select({ formatId: jobs.formatId }).from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.brokerProvider, broker.provider))).orderBy(desc(jobs.createdAt)).limit(1) : [];
    const formatId = broker ? priorBroker?.formatId : input.formatId;
    let format = formatId ? (await tx.select().from(formats).where(and(eq(formats.id, formatId), eq(formats.userId, userId))))[0] : undefined;
    if (input.formatId && !format) throw new ImportError("Formato non disponibile");
    if (!format) [format] = await tx.insert(formats).values({ userId, name: broker && broker.provider !== "generic" ? broker.name : input.name }).returning();
    const [parser] = input.regenerate ? [] : await tx.select().from(parsers).where(and(eq(parsers.formatId, format.id), eq(parsers.signature, signature))).orderBy(desc(parsers.createdAt)).limit(1);
    const [job] = await tx.insert(jobs).values({ userId, consentVersion: "openrouter-raw-zdr-v3", formatId: format.id, parserId: parser?.id, brokerProvider: broker?.provider, sourceFingerprint, failureReport: broker ? { phase: "parse", reason: broker.requiresReconciliation ? "broker_validation_failed" : "broker_parse_failed", fallback: true } : null, encryptedCsv: seal(input.csv, userId), estimatedAt: new Date(Date.now() + 3600000), expiresAt: new Date(Date.now() + 7 * 86400000) }).returning({ id: jobs.id, status: jobs.status, formatId: jobs.formatId });
    return job;
  });
}
export async function listImports(userId: string) {
  const [sources, requests] = await Promise.all([
    db.select({ id: formats.id, name: formats.name }).from(formats).where(eq(formats.userId, userId)).orderBy(desc(formats.createdAt)),
    db.select({ id: jobs.id, formatId: jobs.formatId, status: jobs.status, estimatedAt: jobs.estimatedAt, expiresAt: jobs.expiresAt, createdAt: jobs.createdAt, error: jobs.error, notifiedAt: jobs.notifiedAt, ledger: jobs.importLedger, parserId: jobs.parserId, failureReport: jobs.failureReport }).from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt)),
  ]);
  // Del registro dell'importazione esce solo il conteggio (movimenti e operazioni creati), mai gli id.
  // Of the failure report only the attempt in progress leaves the server, never reasons or rows.
  return { formats: sources, jobs: requests.map(({ ledger, parserId, failureReport, ...job }) => ({ ...job, progress: analysisProgress({ status: job.status, parserId, failureReport }), results: ledger ? { cash: ledger.cashIds.length, investments: ledger.tradeIds.length, skipped: ledger.skipped ?? 0, bankCategorized: ledger.bankCategorized ?? 0, ...importCounts(ledger), ...(ledger.native ? { native: { name: ledger.native.name, inserted: ledger.native.inserted } } : {}) } : null })) };
}
/** Anteprima per il client: il parser generato (se presente) resta sul server. */
export async function getPreview(userId: string, id: string): Promise<Preview | null> {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
  if (!job || !job.encryptedPreview || job.expiresAt < new Date()) return null;
  // Previews written before 2026-10-31 may still carry a parser: it never leaves the server.
  const { parser: _parser, ...preview }: Preview & { parser?: unknown } = JSON.parse(unseal(job.encryptedPreview, userId));
  void _parser;
  return preview;
}
