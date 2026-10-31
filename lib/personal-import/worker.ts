import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, lte, inArray, sql, type SQL } from "drizzle-orm";
import { importNatively, type NativeOutcome } from "./native";
import { investmentImportDeps } from "@/lib/investments/import/deps";
import { resolveIdentity } from "@/lib/investments/import/resolve";
import { searchByIsinOnProviders, searchCryptoOnProviders, searchInstrumentsOnProviders } from "@/lib/market-data/runtime";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { personalImportJobs as jobs, personalParsers as parsers, personalFormats as formats } from "@/lib/db/schema/personal-imports";
import { logger, recordPersonalImportAttempt } from "@/lib/observability";
import { categorizeNewMovementsSafely } from "@/lib/categorization/auto-apply";
import { confirmImport, type Preview } from "./confirm";
import { ImportError, readRawFile, parserSchema } from "./contract";
import { seal, unseal, digest } from "./crypto";
import { RAW_PARSER_VERSION, importFailedMessage } from "./jobs";
import { executeParser } from "./sandbox";
import { getUserCurrency, todayKey } from "@/lib/investments/operations";
import { resolveFxRates } from "@/lib/investments/import/execute";
import { updateFxRates } from "@/lib/market-data/update";
import { marketDataDeps } from "@/lib/market-data/runtime";
import { personalImportEmailContent } from "./emails";
import { importCounts } from "./counts";
import { resolveProfile } from "@/lib/localization/config";
import { generateParser, ModelInputError } from "./generate";
import { LadderExhaustedError, runLadder, type AnalysisFailure } from "./analysis";
import { classifyFile, dateOrderHint, type ModelHints } from "./hints";
import { saveFormatMetadata } from "@/lib/imports/store";
import { notifyImportSupport } from "./support-report";
import { fillBankCategories } from "./bank-category-column";

/** The lease is pushed forward this often while the ladder runs, so a 15-minute model call keeps the job. */
const LEASE_KEEPALIVE_MS = 60_000;
const LEASE_MS = 5 * 60_000;
const MAX_TRANSIENT_ATTEMPTS = 3;

export async function processOne() {
  const lease = randomUUID();
  const job = await db.transaction(async tx => {
    // One job per source at a time, oldest first: the files of a batch run in upload order and each can reuse the
    // parser the previous one saved, instead of all asking the AI at once.
    const [candidate] = await tx.select().from(jobs).where(sql`(${jobs.status} = 'queued' AND ${jobs.availableAt} <= now() OR ${jobs.status} = 'processing' AND ${jobs.leaseUntil} < now()) AND ${jobs.expiresAt} > now()
      AND NOT EXISTS (SELECT 1 FROM personal_import_jobs busy WHERE busy.format_id = ${jobs.formatId} AND busy.id <> ${jobs.id} AND busy.status = 'processing' AND busy.lease_until >= now())`).orderBy(jobs.createdAt).limit(1).for("update", { skipLocked: true });
    if (!candidate) return null;
    const [claimed] = await tx.update(jobs).set({ status: "processing", error: null, lease, leaseUntil: new Date(Date.now() + LEASE_MS), attempts: candidate.attempts + 1 }).where(eq(jobs.id, candidate.id)).returning();
    return claimed;
  });
  if (!job) return false;
  const owned = and(eq(jobs.id, job.id), eq(jobs.lease, lease), eq(jobs.status, "processing"));
  logger.info("personal_import.started", { jobId: job.id });
  let phase = "read";
  let leaseLost = false;
  const keepalive = setInterval(() => {
    db.update(jobs).set({ leaseUntil: new Date(Date.now() + LEASE_MS) }).where(owned).returning({ id: jobs.id })
      .then(rows => { if (!rows.length) leaseLost = true; }, () => {});
  }, LEASE_KEEPALIVE_MS);
  // Rejected attempts so far: kept on the job, so a restart resumes from the next step instead of the first.
  let report: AnalysisFailure | null = job.failureReport ?? null;
  try {
    if (job.attempts > MAX_TRANSIENT_ATTEMPTS || !job.encryptedCsv) throw new Error("Tentativi esauriti");
    const raw = unseal(job.encryptedCsv, job.userId);
    const table = readRawFile(raw);
    // A known broker export goes to its built-in reader first: no AI, reconciled. Jobs the old broker wizard sent
    // here (`brokerProvider` already set) failed that reader already.
    if (!job.brokerProvider) {
      phase = "native";
      const native = await importNatively(job.userId, raw, {
        importDeps: await investmentImportDeps(job.userId, task => { void task().catch(() => {}); }),
        resolve: identity => resolveIdentity(job.userId, identity, { searchMarket: searchInstrumentsOnProviders, searchCrypto: searchCryptoOnProviders, searchByIsin: searchByIsinOnProviders }),
      });
      if (native.kind === "imported" || native.kind === "failed") { await finishNative(job.id, owned, native); return true; }
      if (native.kind === "fallback") {
        await db.update(jobs).set({ brokerProvider: native.provider }).where(owned);
        job.brokerProvider = native.provider;
        logger.info("personal_import.native.fallback", { jobId: job.id, provider: native.provider });
      }
    }
    const [saved] = job.parserId ? await db.select().from(parsers).where(and(eq(parsers.id, job.parserId), eq(parsers.formatId, job.formatId))) : [];
    phase = "generate";
    const [source] = await db.select({ name: formats.name }).from(formats).where(and(eq(formats.id, job.formatId), eq(formats.userId, job.userId)));
    const [owner] = await db.select({ currency: authUser.currency, productCountry: authUser.productCountry }).from(authUser).where(eq(authUser.id, job.userId));
    const hints: ModelHints = { defaultCurrency: owner?.currency ?? "EUR", today: todayKey(), dateOrderHint: dateOrderHint(owner?.productCountry), fileKind: classifyFile(table.rawCsv ?? "") };
    const generated = await runLadder({
      table, execute: executeParser, model: process.env.OPENROUTER_MODEL ?? "unknown", done: report?.attempts ?? [],
      saved: saved ? () => ({ parser: parserSchema.parse(JSON.parse(unseal(saved.encryptedParser, job.userId))), model: saved.model }) : undefined,
      generate: request => {
        if (job.consentVersion !== "openrouter-raw-zdr-v3") throw new ModelInputError("Il formato salvato non legge questo file. Avvia una nuova analisi per autorizzare il tentativo automatico con l'AI.");
        logger.info("personal_import.attempt.started", { jobId: job.id, step: request.step });
        return generateParser(table, { sourceName: source?.name, hints, request });
      },
      onAttempt: async record => {
        if (leaseLost) throw new Error("Lease non più disponibile");
        const attempts = [...(report?.attempts ?? []), record];
        report = { ...(report ?? { phase: "parse", reason: record.reason, detail: record.detail, rows: record.rows, count: record.count }), fallback: true, attempts };
        const claimed = await db.update(jobs).set({ failureReport: report, leaseUntil: new Date(Date.now() + LEASE_MS) }).where(owned).returning({ id: jobs.id });
        if (!claimed.length) throw new Error("Lease non più disponibile");
        recordPersonalImportAttempt(record.step, "rejected");
        logger.warn("personal_import.attempt.failed", { jobId: job.id, step: record.step, reason: record.reason });
      },
    });
    recordPersonalImportAttempt(generated.step, generated.reused ? "reused" : "accepted");
    logger.info("personal_import.attempt.succeeded", { jobId: job.id, step: generated.step });
    // The bank's own category column is read from the file too, for parsers that do not return it.
    const outcomes = fillBankCategories(generated.outcomes, table);
    if (generated.parser.kind === "javascript" && generated.parser.metadata) {
      try { await saveFormatMetadata(job.userId, "ai", generated.parser.metadata, outcomes.filter(o => o.kind === "cash" || o.kind === "investment")); }
      catch { logger.warn("import.metadata.failed", { jobId: job.id, reason: "persistence_failed" }); }
    }
    phase = "fx";
    const currency = await getUserCurrency(job.userId);
    const fx = await resolveFxRates(outcomes.flatMap(o => o.kind === "cash" || o.kind === "investment" ? [{ line: o.row, date: o.date, currency: o.currency }] : []), {
      userCurrency: currency, todayKey: todayKey(), createInstrument: async () => { throw new Error("unused"); }, ensureHistory: async () => {},
      fetchFx: async (currencies, from, to) => { await updateFxRates(currencies.filter(c => c !== "EUR"), from, to, marketDataDeps()); },
    });
    if ([...fx.values()].some(rate => rate === null || !Number.isFinite(rate) || rate <= 0)) throw new Error("Cambio storico non disponibile");
    const occurrences = new Map<string, number>();
    const records = table.rows.map((row, i) => { const hash = digest(JSON.stringify(row)); const n = (occurrences.get(hash) ?? 0) + 1; occurrences.set(hash, n); return { key: `${hash}:${n}`, source: row, line: table.sourceLines?.[i], outcome: outcomes[i], rate: fx.get(i) ?? null }; });
    phase = "persist";
    await db.transaction(async tx => {
      const [current] = await tx.select().from(jobs).where(owned).for("update");
      if (!current) return;
      let parserId = generated.reused ? saved?.id : undefined;
      if (!parserId) {
        const [version] = await tx.insert(parsers).values({ formatId: job.formatId, signature: RAW_PARSER_VERSION, encryptedParser: seal(JSON.stringify(generated.parser), job.userId), model: generated.model }).returning(); parserId = version.id;
        // Files of the same source still waiting start from the parser that just worked, not from the one they
        // were uploaded with (none, for a new source; the broken one, after a layout change).
        await tx.update(jobs).set({ parserId }).where(and(eq(jobs.formatId, job.formatId), eq(jobs.status, "queued"), sql`${jobs.id} <> ${job.id}`));
      }
      const preview: Preview = { headers: table.headers, currency, records };
      await tx.update(jobs).set({ status: "ready", parserId, encryptedCsv: null, encryptedPreview: seal(JSON.stringify(preview), job.userId), error: null, failureReport: report, lease: null, leaseUntil: null }).where(owned);
    });
    logger.info("personal_import.completed", { jobId: job.id, count: outcomes.length, step: generated.step, bankCategories: outcomes.filter(o => o.kind === "cash" && o.bankCategory).length });
  } catch (error) {
    // A wrong parser at every step or an input the model refuses ends the job; anything else is retried later.
    const exhausted = error instanceof LadderExhaustedError;
    const terminal = exhausted || error instanceof ModelInputError || job.attempts >= MAX_TRANSIENT_ATTEMPTS;
    const reason = exhausted ? "ladder_exhausted" : error instanceof ModelInputError ? "model_input_rejected" : phase === "fx" ? "exchange_rate_unavailable" : "analysis_failed";
    const failureReport: AnalysisFailure | null = terminal ? { ...(report ?? {}), phase: phase === "fx" ? "fx" : report?.phase ?? "generate", reason, fallback: !!report?.attempts?.length, ...(exhausted ? { attempts: error.attempts } : {}) } : report;
    await db.update(jobs).set({ status: terminal ? "failed" : "queued", error: terminal ? (error instanceof ModelInputError ? error.message : importFailedMessage()) : null, availableAt: new Date(Date.now() + job.attempts * 60000), encryptedCsv: terminal ? null : job.encryptedCsv, failureReport, lease: null, leaseUntil: null }).where(owned);
    logger.warn("personal_import.failed", { jobId: job.id, reason: terminal ? reason : "retry_pending", phase });
  } finally {
    clearInterval(keepalive);
  }
  return true;
}

/** Ends a job a built-in reader handled: imported straight away (nothing to confirm), or failed with its message. */
async function finishNative(jobId: string, owned: SQL | undefined, native: Extract<NativeOutcome, { kind: "imported" | "failed" }>) {
  if (native.kind === "failed") {
    await db.update(jobs).set({ status: "failed", error: native.message, encryptedCsv: null, lease: null, leaseUntil: null, failureReport: { phase: "save", reason: "broker_validation_failed", detail: native.name, fallback: false } }).where(owned);
    logger.warn("personal_import.native.failed", { jobId, provider: native.provider });
    return;
  }
  const { result, provider, name } = native;
  const [job] = await db.update(jobs).set({ status: "imported", error: null, encryptedCsv: null, lease: null, leaseUntil: null, brokerProvider: provider, notifiedAt: null, notifyAfter: new Date(), importLedger: { cashIds: [], tradeIds: [], receiptKeys: [], rows: result.counts.new + result.counts.duplicate, alreadyPresent: result.counts.duplicate, native: { provider, name, inserted: result.inserted } } }).where(owned).returning({ userId: jobs.userId });
  logger.info("personal_import.native.imported", { jobId, provider, count: result.inserted });
  recordPersonalImportAttempt(0, "native");
  if (job && result.inserted > 0) await categorizeNewMovementsSafely(job.userId);
}

export async function maintainJobs() {
  await notifyImportSupport();
  // `review_failed` is no longer reached (2026-10-31: no rows to fix by hand); jobs left in it expire now.
  await db.update(jobs).set({ encryptedCsv: null, encryptedPreview: null, status: "expired", lease: null, leaseUntil: null }).where(sql`(${jobs.expiresAt} <= now() and ${jobs.status} not in ('imported', 'expired')) or ${jobs.status} = 'review_failed'`);
  // Ready is durable: a restart after analysis resumes the atomic import without another AI call.
  const [ready] = await db.select().from(jobs).where(and(eq(jobs.status, "ready"), lte(jobs.availableAt, new Date()))).orderBy(jobs.createdAt).limit(1);
  if (ready) {
    try {
      const result = await confirmImport(ready.userId, ready.id);
      logger.info("personal_import.saved", { jobId: ready.id, count: result.inserted, ...("rows" in result ? { total: result.rows, skipped: result.alreadyPresent } : {}) });
      await categorizeNewMovementsSafely(ready.userId);
    } catch (error) {
      await db.update(jobs).set(error instanceof ImportError
        ? { status: "failed", error: error.message, encryptedPreview: null, notifiedAt: null, failureReport: { ...(ready.failureReport ?? { fallback: false }), phase: "save" as const, reason: "financial_validation_failed" } }
        : { availableAt: new Date(Date.now() + 60000) }
      ).where(and(eq(jobs.id, ready.id), eq(jobs.status, "ready")));
      logger.warn("personal_import.save_failed", { jobId: ready.id, reason: error instanceof ImportError ? "validation_failed" : "retry_pending" });
    }
  }
  // Atomic notification claim; independent retries never rerun the parser or import financial data.
  const pending = await db.transaction(async tx => {
    const [job] = await tx.select().from(jobs).where(and(inArray(jobs.status, ["imported", "failed"]), sql`${jobs.notifiedAt} is null`, lte(jobs.notifyAfter, new Date()))).limit(1).for("update", { skipLocked: true });
    if (!job) return null;
    await tx.update(jobs).set({ notifyAfter: new Date(Date.now() + 15 * 60000) }).where(eq(jobs.id, job.id));
    return job;
  });
  if (!pending) return;
  try {
    if (!isEmailConfigured() || !process.env.APP_URL) throw new Error("Email non configurata");
    const [user] = await db.select({ email: authUser.email, productCountry: authUser.productCountry, language: authUser.language }).from(authUser).where(eq(authUser.id, pending.userId));
    if (!user) return;
    const url = new URL(`/importazioni?job=${pending.id}`, process.env.APP_URL).toString();
    const { subject, text, html } = personalImportEmailContent(pending.status === "imported" ? "imported" : "failed", { jobUrl: url, appUrl: process.env.APP_URL, language: resolveProfile(user).language, counts: importCounts(pending.importLedger) });
    const result = await sendEmail({ to: user.email, subject, text, html, idempotencyKey: `personal-csv-${pending.id}` });
    if (!result.ok) throw new Error("Invio fallito");
    await db.update(jobs).set({ notifiedAt: new Date() }).where(eq(jobs.id, pending.id));
  } catch { logger.warn("personal_import.email_failed", { jobId: pending.id, reason: "delivery_failed" }); }
}
