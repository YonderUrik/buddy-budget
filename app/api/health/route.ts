import { APP_BUILD_INFO } from "@/lib/app-version";
import { withRoute } from "@/lib/observability";

export const dynamic = "force-dynamic";

/**
 * Liveness: 200 finché il processo Node risponde. Non tocca DB/Redis di proposito:
 * se cade una dipendenza, riavviare l'app non servirebbe (ci pensa la readiness).
 * Espone anche versione/commit della build, per verificare quale deploy sta girando.
 */
function handleGet() {
  return Response.json(
    { status: "ok", ...APP_BUILD_INFO },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export const GET = withRoute("health.live", handleGet, { quietOnSuccess: true });
