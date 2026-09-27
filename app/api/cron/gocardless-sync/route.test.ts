import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/redis-ops-store", async () => {
  const { createMemoryOpsKv, createOpsStore } = await import("@/lib/observability/ops-store");
  return { redisOpsStore: createOpsStore(createMemoryOpsKv()) };
});
vi.mock("@/lib/gocardless/scheduler", () => ({ runDueSyncs: vi.fn() }));

import { runDueSyncs } from "@/lib/gocardless/scheduler";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedRun = vi.mocked(runDueSyncs);

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost/api/cron/gocardless-sync", { headers }));
}

describe("GET /api/cron/gocardless-sync", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedRun.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("risponde 401 senza segreto e non avvia il sync", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer sbagliato")).status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("avvia il sync e risponde 200 col segreto giusto", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(mockedRun).toHaveBeenCalledOnce();
    expect((await redisOpsStore.getCronSuccesses()).gocardless_sync).toBeGreaterThan(0);
  });

  it("risponde 500 se il sync lancia, così il fallimento è visibile al chiamante", async () => {
    mockedRun.mockRejectedValue(new Error("DB giù"));
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false });
  });
});
