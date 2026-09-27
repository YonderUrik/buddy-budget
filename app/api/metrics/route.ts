import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { createScrapeDeps } from "@/lib/observability/scrape-deps";
import { configureAsyncGauges, getMetricsRegistry, withRoute } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * Metriche Prometheus dell'app per lo scrape di Alloy. Protetta da `Authorization: Bearer <METRICS_TOKEN>`;
 * senza METRICS_TOKEN configurato risponde 404 (es. su Vercel, dove nessuno fa scrape).
 */
async function handleGet(request: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return new Response(null, { status: 404 });
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), token)) {
    return new Response(null, { status: 401 });
  }
  configureAsyncGauges(createScrapeDeps());
  const registry = getMetricsRegistry();
  return new Response(await registry.metrics(), {
    status: 200,
    headers: { "Content-Type": registry.contentType, "Cache-Control": "no-store" },
  });
}

export const GET = withRoute("metrics", handleGet, { quietOnSuccess: true });
