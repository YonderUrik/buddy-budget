import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runInactiveAccounts } from "@/lib/account/inactivity";
import { parseInactivityMode } from "@/lib/account/inactivity-policy";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron giornaliero sugli account inattivi: avvisa chi non accede da 83 giorni e, 7 giorni dopo l'avviso, elimina
 * chi non è rientrato. `INACTIVITY_CLEANUP_MODE` = `off` | `dry-run` (default: conta, non scrive né invia) | `execute`.
 * Il cron risulta fallito se un utente non è stato elaborato, così l'alert esistente lo segnala.
 */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  const log = requestLogger();
  const mode = parseInactivityMode(process.env.INACTIVITY_CLEANUP_MODE);
  let result;
  try {
    result = await runInactiveAccounts({ mode, log });
  } catch (error) {
    await recordCronRun("inactive_accounts", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
  const durationMs = Date.now() - startedAt;
  log.info("account.inactivity.run_completed", { outcome: mode, count: result.scanned, deleted: result.deleted + result.wouldDelete, durationMs });
  const ok = result.failed === 0;
  await recordCronRun("inactive_accounts", ok ? "success" : "error", durationMs, {
    store: redisOpsStore,
    log,
    error: ok ? undefined : new Error(`${result.failed} account non elaborati`),
  });
  return Response.json({ ok, ...result, durationMs }, { status: ok ? 200 : 500 });
}

export const GET = withRoute("cron.inactive_accounts", handleGet);
