import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/redis-ops-store", async () => {
  const { createMemoryOpsKv, createOpsStore } = await import("@/lib/observability/ops-store");
  return { redisOpsStore: createOpsStore(createMemoryOpsKv()) };
});
vi.mock("@/lib/account/inactivity", () => ({ runInactiveAccounts: vi.fn() }));

import { runInactiveAccounts } from "@/lib/account/inactivity";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedRun = vi.mocked(runInactiveAccounts);
const RESULT = { mode: "dry-run" as const, scanned: 4, warned: 0, wouldWarn: 2, deleted: 0, wouldDelete: 1, returned: 0, exempt: 0, capped: 0, failed: 0 };

function call(authorization?: string) {
  return GET(new NextRequest("http://localhost/api/cron/inactive-accounts", { headers: authorization ? { authorization } : undefined }));
}

describe("GET /api/cron/inactive-accounts", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedRun.mockReset().mockResolvedValue(RESULT);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("risponde 401 senza segreto e non fa nulla", async () => {
    expect((await call()).status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("senza variabile gira in dry-run", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(mockedRun.mock.calls[0][0].mode).toBe("dry-run");
    expect(await response.json()).toMatchObject({ ok: true, wouldWarn: 2, wouldDelete: 1 });
  });

  it("execute solo con il valore esatto", async () => {
    vi.stubEnv("INACTIVITY_CLEANUP_MODE", "execute");
    await call(`Bearer ${SECRET}`);
    expect(mockedRun.mock.calls[0][0].mode).toBe("execute");
    vi.stubEnv("INACTIVITY_CLEANUP_MODE", "si");
    await call(`Bearer ${SECRET}`);
    expect(mockedRun.mock.calls[1][0].mode).toBe("dry-run");
  });

  it("risponde 500 se un utente non è stato elaborato o se il giro lancia", async () => {
    mockedRun.mockResolvedValue({ ...RESULT, failed: 1 });
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
    mockedRun.mockRejectedValue(new Error("DB giù"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
