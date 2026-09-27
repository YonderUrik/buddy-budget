import type { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { configureAsyncGauges, getMetricsRegistry } from "@/lib/observability";
import { createScrapeDeps } from "@/lib/observability/scrape-deps";

export const dynamic = "force-dynamic";

/**
 * Metriche Prometheus dell'app per lo scrape di Alloy. Protetta da `Authorization: Bearer <METRICS_TOKEN>`;
 * senza METRICS_TOKEN configurato risponde 404 (es. su Vercel, dove nessuno fa scrape).
 */
export async function GET(request: NextRequest) {
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
