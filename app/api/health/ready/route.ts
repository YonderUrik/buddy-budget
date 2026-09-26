import { client } from "@/lib/db/client";
import { checkReadiness } from "@/lib/health/readiness";
import { redis } from "@/lib/redis/client";

export const dynamic = "force-dynamic";

/** Readiness: 200 se Postgres e Redis rispondono entro il timeout, altrimenti 503 (il pod esce dal bilanciamento). */
export async function GET() {
  const result = await checkReadiness({
    database: async () => {
      await client`select 1`;
    },
    redis: () => redis.ping(),
  });
  return Response.json(result, {
    status: result.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
