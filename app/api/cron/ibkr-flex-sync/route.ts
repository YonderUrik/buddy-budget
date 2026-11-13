import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";
import { runDueIbkrFlexSyncs } from "@/lib/ibkr-flex";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Automatic IBKR Flex syncs (meant to run hourly): each connection is brought up to yesterday about once a day,
 * failures back off from one hour to a day, refused credentials wait for the user. Responds with counts only.
 */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) return new Response(null, { status: 401 });
  const startedAt = Date.now();
  const log = requestLogger();
  try {
    const totals = await runDueIbkrFlexSyncs();
    log.info("ibkr_flex.cron.completed", { total: totals.due, processed: totals.synced, rejected: totals.failed, skipped: totals.skipped });
    await recordCronRun("ibkr_flex_sync", "success", Date.now() - startedAt, { store: redisOpsStore, log });
    return Response.json({ ok: true, ...totals });
  } catch (error) {
    await recordCronRun("ibkr_flex_sync", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
}

export const GET = withRoute("cron.ibkr_flex_sync", handleGet);
