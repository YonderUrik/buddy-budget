import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/redis-ops-store", async () => {
  const { createMemoryOpsKv, createOpsStore } = await import("@/lib/observability/ops-store");
  return { redisOpsStore: createOpsStore(createMemoryOpsKv()) };
});
vi.mock("@/lib/net-worth/scheduler", () => ({ runDailySnapshots: vi.fn() }));

import { runDailySnapshots } from "@/lib/net-worth/scheduler";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedRun = vi.mocked(runDailySnapshots);

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost/api/cron/net-worth-snapshot", { headers }));
}

describe("GET /api/cron/net-worth-snapshot", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedRun.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("risponde 401 senza segreto e non scrive snapshot", async () => {
    expect((await call()).status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("scrive gli snapshot e risponde 200 col segreto giusto", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(mockedRun).toHaveBeenCalledOnce();
  });

  it("risponde 500 se lo snapshot lancia", async () => {
    mockedRun.mockRejectedValue(new Error("DB giù"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
