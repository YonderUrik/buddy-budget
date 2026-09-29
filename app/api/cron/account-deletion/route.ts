import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { purgeDueAccountDeletions } from "@/lib/account/lifecycle";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron giornaliero: elimina definitivamente gli account disattivati il cui periodo di ripensamento è finito. */
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
  const durationMs = Date.now() - startedAt;
  // Un utente non eliminato va rifatto: il cron risulta fallito così l'alert lo segnala.
  const outcome = result.failed > 0 ? "error" : "success";
  await recordCronRun("account_deletion", outcome, durationMs, { store: redisOpsStore, log });
  return Response.json({ ok: result.failed === 0, ...result, durationMs }, { status: result.failed > 0 ? 500 : 200 });
}

export const GET = withRoute("cron.account_deletion", handleGet);
