import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { recordCronRun, requestLogger, withRoute } from "@/lib/observability";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";
import { isPublicDemoEnabled } from "@/lib/public-demo/config";
import { resetPublicDemos } from "@/lib/public-demo/reset";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily cron of the public demo: rebuilds the read-only sample account of every country and language, so dates follow today.
 * With `PUBLIC_DEMO_ENABLED` off (self-hosting, staging) it does nothing and writes no heartbeat. The run fails if
 * any account could not be rebuilt, so the existing "cron failed" alert reports it.
 */
async function handleGet(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }
  if (!isPublicDemoEnabled()) return Response.json({ ok: true, skipped: true });
  const startedAt = Date.now();
  const log = requestLogger();
  let result;
  try {
    result = await resetPublicDemos({ log });
  } catch (error) {
    await recordCronRun("public_demo", "error", Date.now() - startedAt, { store: redisOpsStore, log, error });
    return Response.json({ ok: false }, { status: 500 });
  }
  const durationMs = Date.now() - startedAt;
  const ok = result.failed.length === 0;
  await recordCronRun("public_demo", ok ? "success" : "error", durationMs, {
    store: redisOpsStore,
    log,
    error: ok ? undefined : new Error(`demo not rebuilt: ${result.failed.join(", ")}`),
  });
  return Response.json({ ok, ...result, durationMs }, { status: ok ? 200 : 500 });
}

export const GET = withRoute("cron.public_demo", handleGet);
