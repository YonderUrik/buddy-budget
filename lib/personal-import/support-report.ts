import "server-only";
import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import { isSelfHosted } from "@/lib/instance/config";
import { db } from "@/lib/db/client";
import { personalImportJobs as jobs } from "@/lib/db/schema/personal-imports";
import { SUPPORT_EMAIL } from "@/lib/support";
import { logger } from "@/lib/observability";
import type { AnalysisFailure } from "./analysis";

const REASONS: Record<string, string> = {
  unrecognized_rows: "Il parser non ha riconosciuto tutte le righe del documento.",
  invalid_saved_parser: "Il parser salvato non supera i controlli di esecuzione, struttura, copertura delle righe o determinismo.",
  model_input_rejected: "Il modello ha rifiutato il file completo oppure ha esaurito il budget di generazione.",
  exchange_rate_unavailable: "Non è stato possibile ottenere tutti i cambi storici necessari.",
  analysis_failed: "Generazione AI o esecuzione del parser non riuscita dopo i tentativi previsti.",
  financial_validation_failed: "I dati non superano i controlli finanziari: storico, duplicati, quantità o valuta del profilo.",
  broker_parse_failed: "Il lettore del broker non riesce a interpretare la struttura del documento.",
  broker_validation_failed: "Il lettore del broker ha rilevato un errore che richiede riconciliazione. L'analisi AI non autorizza a ignorare questo controllo.",
};
/** Support receives bounded diagnostics and row numbers; never the CSV, financial values or generated code. */
export function importSupportReport(id: string, status: string, attempts: number, failure: AnalysisFailure) {
  return { subject: `Importazione: report ${id}`, text: [
    `Importazione: ${id}`, `Esito attuale: ${status}`, `Tentativi: ${attempts}`, `Fase del primo errore: ${failure.phase}`,
    `Causa: ${REASONS[failure.reason] ?? "Errore di analisi non classificato."}`,
    ...(failure.detail ? [`Diagnosi: ${failure.detail}`] : []),
    `Fallback AI: ${failure.fallback ? "avviato automaticamente" : "non applicabile a questa fase"}`,
    ...(failure.count === undefined ? [] : [`Righe non riconosciute: ${failure.count}`]),
    ...(failure.rows?.length ? [`Prime righe interessate: ${failure.rows.join(", ")}`] : []),
  ].join("\n") };
}

/** Independently retry support email: delivery failures never repeat analysis or financial writes. */
export async function notifyImportSupport() {
  const pending = await db.transaction(async tx => {
    const [job] = await tx.select().from(jobs).where(and(inArray(jobs.status, ["imported", "review_failed", "failed", "expired"]), sql`${jobs.failureReport} is not null`, sql`${jobs.supportNotifiedAt} is null`, lte(jobs.supportNotifyAfter, new Date()))).limit(1).for("update", { skipLocked: true });
    if (!job) return null;
    await tx.update(jobs).set({ supportNotifyAfter: new Date(Date.now() + 15 * 60000) }).where(eq(jobs.id, job.id));
    return job;
  });
  if (!pending?.failureReport) return;
  try {
    const to = process.env.SUPPORT_EMAIL_TO?.trim() || (isSelfHosted() ? null : SUPPORT_EMAIL);
    // Self-hosted without SUPPORT_EMAIL_TO: the report stays on the import screen, nothing goes to the project.
    if (!to) {
      await db.update(jobs).set({ supportNotifiedAt: new Date() }).where(eq(jobs.id, pending.id));
      return;
    }
    const result = await sendEmail({ to, ...importSupportReport(pending.id, pending.status, pending.attempts, pending.failureReport), idempotencyKey: `import-support-${pending.id}` });
    if (!result.ok) throw new Error("Invio fallito");
    await db.update(jobs).set({ supportNotifiedAt: new Date() }).where(eq(jobs.id, pending.id));
    logger.info("personal_import.support.sent", { jobId: pending.id });
  } catch { logger.warn("personal_import.support.failed", { jobId: pending.id, reason: "delivery_failed" }); }
}
