import { APP_BUILD_INFO } from "@/lib/app-version";

export const dynamic = "force-dynamic";

/**
 * Liveness: 200 finché il processo Node risponde. Non tocca DB/Redis di proposito:
 * se cade una dipendenza, riavviare l'app non servirebbe (ci pensa la readiness).
 * Espone anche versione/commit della build, per verificare quale deploy sta girando.
 */
export function GET() {
  return Response.json(
    { status: "ok", ...APP_BUILD_INFO },
    { headers: { "Cache-Control": "no-store" } }
  );
}
