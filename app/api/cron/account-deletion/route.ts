import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { purgeDueAccountDeletions } from "@/lib/account/lifecycle";
import { purgeExpiredAuthData, type AuthRetentionResult } from "@/lib/account/retention";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron giornaliero: elimina definitivamente gli account disattivati il cui periodo di ripensamento è finito e,
 * nello stesso giro, le sessioni e i token di accesso scaduti (conservazione dei dati). Il cron risulta fallito
 * se uno dei due passaggi fallisce, così l'alert esistente lo segnala.
 */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  const log = requestLogger();
  let result: { deleted: number; failed: number };
  try {
    result = await purgeDueAccountDeletions();
  } catch (error) {
    await recordCronRun("account_deletion", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
  let retentionFailed = false;
  let retention: AuthRetentionResult = { sessions: 0, verifications: 0 };
  try {
    retention = await purgeExpiredAuthData();
    log.info("account.retention.purged", { sessionsPurged: retention.sessions, verificationsPurged: retention.verifications });
  } catch (error) {
    retentionFailed = true;
    log.error("account.retention.failed", { error });
  }
  const durationMs = Date.now() - startedAt;
  // Un utente non eliminato va rifatto: il cron risulta fallito così l'alert lo segnala.
  const ok = result.failed === 0 && !retentionFailed;
  await recordCronRun("account_deletion", ok ? "success" : "error", durationMs, { store: redisOpsStore, log });
  return Response.json({ ok, ...result, retention, durationMs }, { status: ok ? 200 : 500 });
}

export const GET = withRoute("cron.account_deletion", handleGet);
