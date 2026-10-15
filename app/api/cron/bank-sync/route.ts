import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDueSyncs } from "@/lib/bank-data/scheduler";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
// I conti dovuti si sincronizzano dentro la richiesta: nessun utente aspetta la risposta, quindi
// niente job/after() (lo standard "Operazioni lunghe" riguarda le operazioni avviate dall'utente).
export const maxDuration = 300;

/** Cron di sync dei conti collegati alla banca (tutti i fornitori), solo quelli dovuti. Idempotente. */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  const log = requestLogger();
  try {
    await runDueSyncs();
  } catch (error) {
    await recordCronRun("bank_sync", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
  const durationMs = Date.now() - startedAt;
  await recordCronRun("bank_sync", "success", durationMs, { store: redisOpsStore, log });
  return Response.json({ ok: true, durationMs });
}

export const GET = withRoute("cron.bank_sync", handleGet);
