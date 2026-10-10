import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { parseNotificationsMode, runNotifications, type NotificationsResult } from "@/lib/notifications/server";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron giornaliero: riepilogo periodico, avvisi sulle rate in scadenza e avvisi sui budget, solo per chi li ha attivati.
 * `NOTIFICATIONS_MODE` = `off` | `dry-run` (default: calcola e conta, non invia) | `execute` (invia davvero).
 */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  const log = requestLogger();
  let result: NotificationsResult;
  try {
    result = await runNotifications({ mode: parseNotificationsMode(process.env.NOTIFICATIONS_MODE), log });
  } catch (error) {
    await recordCronRun("notifications", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
  const durationMs = Date.now() - startedAt;
  // Un invio fallito si ritenta al giro dopo (le chiavi vengono rilasciate): il cron risulta fallito così l'alert lo segnala.
  const outcome = result.failed > 0 ? "error" : "success";
  await recordCronRun("notifications", outcome, durationMs, {
    store: redisOpsStore,
    log,
    error: result.failed > 0 ? new Error(`${result.failed} invii falliti`) : undefined,
  });
  return Response.json({ ok: result.failed === 0, ...result, durationMs }, { status: result.failed > 0 ? 500 : 200 });
}

export const GET = withRoute("cron.notifications", handleGet);
