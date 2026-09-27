import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { runDailySnapshots } from "@/lib/net-worth/scheduler";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Cron giornaliero degli snapshot patrimonio di tutti gli utenti con conti. Idempotente (upsert per giorno). */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  const startedAt = Date.now();
  const log = requestLogger();
  try {
    await runDailySnapshots();
  } catch (error) {
    await recordCronRun("net_worth_snapshot", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
  const durationMs = Date.now() - startedAt;
  await recordCronRun("net_worth_snapshot", "success", durationMs, { store: redisOpsStore, log });
  return Response.json({ ok: true, durationMs });
}

export const GET = withRoute("cron.net_worth_snapshot", handleGet);
