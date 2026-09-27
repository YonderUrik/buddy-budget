import { client } from "@/lib/db/client";
import { checkReadiness } from "@/lib/health/readiness";
import { redis } from "@/lib/redis/client";
import { withRoute } from "@/lib/observability";

export const dynamic = "force-dynamic";

/** Readiness: 200 se Postgres e Redis rispondono entro il timeout, altrimenti 503 (il pod esce dal bilanciamento). */
async function handleGet() {
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

export const GET = withRoute("health.ready", handleGet, { quietOnSuccess: true });
