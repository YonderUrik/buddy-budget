import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { parseMaintenanceMode, runGoCardlessMaintenance, type MaintenanceResult } from "@/lib/gocardless/maintenance";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron giornaliero: segna le connessioni bancarie scadute, avvisa via email chi deve rinnovare e ripulisce la
 * lista GoCardless. `GOCARDLESS_CLEANUP_MODE` = `off` | `dry-run` (default) | `execute`;
 * `GOCARDLESS_CLEANUP_DELETE_UNKNOWN=true` abilita anche l'eliminazione di ciò che a DB non risulta.
 */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  const log = requestLogger();
  let result: MaintenanceResult;
  try {
    result = await runGoCardlessMaintenance({
      mode: parseMaintenanceMode(process.env.GOCARDLESS_CLEANUP_MODE),
      deleteUnknown: process.env.GOCARDLESS_CLEANUP_DELETE_UNKNOWN === "true",
      log,
    });
  } catch (error) {
    await recordCronRun("gocardless_maintenance", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
  const durationMs = Date.now() - startedAt;
  // Un'email o un'eliminazione fallita va rifatta: il cron risulta fallito così l'alert lo segnala.
  const outcome = result.failed > 0 ? "error" : "success";
  await recordCronRun("gocardless_maintenance", outcome, durationMs, {
    store: redisOpsStore,
    log,
    error: result.failed > 0 ? new Error(`${result.failed} operazioni fallite`) : undefined,
  });
  return Response.json({ ok: result.failed === 0, ...result, durationMs }, { status: result.failed > 0 ? 500 : 200 });
}

export const GET = withRoute("cron.gocardless_maintenance", handleGet);
