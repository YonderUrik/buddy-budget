import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/redis-ops-store", async () => {
  const { createMemoryOpsKv, createOpsStore } = await import("@/lib/observability/ops-store");
  return { redisOpsStore: createOpsStore(createMemoryOpsKv()) };
});
vi.mock("@/lib/notifications/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notifications/server")>()),
  runNotifications: vi.fn(),
}));

import { runNotifications } from "@/lib/notifications/server";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedRun = vi.mocked(runNotifications);
const OK_RESULT = { mode: "dry-run" as const, users: 3, sent: 0, wouldSend: 2, capped: 0, empty: 1, failed: 0, purged: 0, timedOut: false };

function call(authorization?: string) {
  return GET(new NextRequest("http://localhost/api/cron/notifications", { headers: authorization ? { authorization } : undefined }));
}

describe("GET /api/cron/notifications", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedRun.mockReset().mockResolvedValue(OK_RESULT);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("risponde 401 senza segreto e non fa nulla", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer sbagliato")).status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("senza variabile gira in dry-run: nessun invio reale finché non si imposta `execute`", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, wouldSend: 2 });
    expect(mockedRun).toHaveBeenCalledWith(expect.objectContaining({ mode: "dry-run" }));
  });

  it("legge la modalità dall'ambiente; un valore sconosciuto ricade su dry-run", async () => {
    vi.stubEnv("NOTIFICATIONS_MODE", "execute");
    await call(`Bearer ${SECRET}`);
    expect(mockedRun).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "execute" }));
    vi.stubEnv("NOTIFICATIONS_MODE", "esegui");
    await call(`Bearer ${SECRET}`);
    expect(mockedRun).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "dry-run" }));
  });

  it("risponde 500 se un invio è fallito o se il giro lancia", async () => {
    mockedRun.mockResolvedValueOnce({ ...OK_RESULT, failed: 1 });
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
    mockedRun.mockRejectedValueOnce(new Error("db giù"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
