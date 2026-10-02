import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/redis-ops-store", async () => {
  const { createMemoryOpsKv, createOpsStore } = await import("@/lib/observability/ops-store");
  return { redisOpsStore: createOpsStore(createMemoryOpsKv()) };
});
vi.mock("@/lib/account/lifecycle", () => ({ purgeDueAccountDeletions: vi.fn() }));
vi.mock("@/lib/account/retention", () => ({ purgeExpiredAuthData: vi.fn() }));

import { purgeDueAccountDeletions } from "@/lib/account/lifecycle";
import { purgeExpiredAuthData } from "@/lib/account/retention";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedPurge = vi.mocked(purgeDueAccountDeletions);
const mockedRetention = vi.mocked(purgeExpiredAuthData);

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost/api/cron/account-deletion", { headers }));
}

describe("GET /api/cron/account-deletion", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedPurge.mockReset().mockResolvedValue({ deleted: 1, failed: 0 });
    mockedRetention.mockReset().mockResolvedValue({ sessions: 3, verifications: 2 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("risponde 401 senza segreto e non elimina nulla", async () => {
    expect((await call()).status).toBe(401);
    expect(mockedPurge).not.toHaveBeenCalled();
  });

  it("elimina gli account scaduti e risponde 200", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, deleted: 1, failed: 0, retention: { sessions: 3, verifications: 2 } });
  });

  it("risponde 500 se un'eliminazione fallisce o se il cron lancia", async () => {
    mockedPurge.mockResolvedValue({ deleted: 0, failed: 1 });
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
    mockedPurge.mockRejectedValue(new Error("DB giù"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });

  it("risponde 500 se la pulizia dei dati di accesso scaduti fallisce, senza fermare l'eliminazione degli account", async () => {
    mockedRetention.mockRejectedValue(new Error("DB giù"));
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, deleted: 1, failed: 0 });
  });
});
