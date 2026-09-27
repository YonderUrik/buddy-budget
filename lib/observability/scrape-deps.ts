import "server-only";
import { client } from "@/lib/db/client";
import { checkReadiness } from "@/lib/health/readiness";
import { redis } from "@/lib/redis/client";
import type { AsyncGaugeDeps } from "./metrics";

/**
 * Letture reali delle gauge asincrone (Postgres, Redis). Separate dal registry così `metrics.ts`
 * resta importabile ovunque senza trascinarsi dietro connessioni a DB/Redis.
 */
export function createScrapeDeps(): AsyncGaugeDeps {
  return {
    dependencies: async () => {
      const result = await checkReadiness({
        postgres: async () => {
          await client`select 1`;
        },
        redis: () => redis.ping(),
      });
      return { postgres: result.checks.postgres === "ok", redis: result.checks.redis === "ok" };
    },
  };
}
