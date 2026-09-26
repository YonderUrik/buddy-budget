export const dynamic = "force-dynamic";

/**
 * Liveness: 200 finché il processo Node risponde. Non tocca DB/Redis di proposito:
 * se cade una dipendenza, riavviare l'app non servirebbe (ci pensa la readiness).
 */
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
