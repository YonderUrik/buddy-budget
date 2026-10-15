import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { parseApprovedRequisitions, parseMaintenanceMode, runBankMaintenance, type MaintenanceResult } from "@/lib/bank-data/maintenance";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron giornaliero: segna le connessioni bancarie scadute, avvisa via email chi deve rinnovare e revoca i consensi
 * non più usati presso il loro fornitore. `BANK_CLEANUP_MODE` (o il vecchio `GOCARDLESS_CLEANUP_MODE`) = `off` |
 * `dry-run` (default) | `execute`. Solo per GoCardless: `GOCARDLESS_CLEANUP_DELETE_UNKNOWN=true` abilita anche
 * l'eliminazione di ciò che altri ambienti hanno lasciato; `GOCARDLESS_CLEANUP_APPROVED_REQUISITIONS` elenca le
 * requisition collegate (LN) sconosciute approvate a mano.
 */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  const log = requestLogger();
  let result: MaintenanceResult;
  try {
    result = await runBankMaintenance({
      mode: parseMaintenanceMode(process.env.BANK_CLEANUP_MODE || process.env.GOCARDLESS_CLEANUP_MODE),
      deleteUnknown: process.env.GOCARDLESS_CLEANUP_DELETE_UNKNOWN === "true",
      approvedRequisitionIds: parseApprovedRequisitions(process.env.GOCARDLESS_CLEANUP_APPROVED_REQUISITIONS),
      log,
    });
  } catch (error) {
    await recordCronRun("bank_maintenance", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
  const durationMs = Date.now() - startedAt;
  // Un'email o un'eliminazione fallita va rifatta: il cron risulta fallito così l'alert lo segnala.
  const outcome = result.failed > 0 ? "error" : "success";
  await recordCronRun("bank_maintenance", outcome, durationMs, {
    store: redisOpsStore,
    log,
    error: result.failed > 0 ? new Error(`${result.failed} operazioni fallite`) : undefined,
  });
  return Response.json({ ok: result.failed === 0, ...result, durationMs }, { status: result.failed > 0 ? 500 : 200 });
}

export const GET = withRoute("cron.bank_maintenance", handleGet);
