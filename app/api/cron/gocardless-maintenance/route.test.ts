import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/redis-ops-store", async () => {
  const { createMemoryOpsKv, createOpsStore } = await import("@/lib/observability/ops-store");
  return { redisOpsStore: createOpsStore(createMemoryOpsKv()) };
});
vi.mock("@/lib/gocardless/maintenance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/gocardless/maintenance")>()),
  runGoCardlessMaintenance: vi.fn(),
}));

import { runGoCardlessMaintenance } from "@/lib/gocardless/maintenance";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedRun = vi.mocked(runGoCardlessMaintenance);
const OK_RESULT = { expiredMarked: 1, notices: { sent: 2, failed: 0 }, cleanup: null, failed: 0 };

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost/api/cron/gocardless-maintenance", { headers }));
}

describe("GET /api/cron/gocardless-maintenance", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedRun.mockReset().mockResolvedValue(OK_RESULT);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("risponde 401 senza segreto e non fa nulla", async () => {
    expect((await call()).status).toBe(401);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("senza variabili gira in dry-run e non abilita l'eliminazione degli sconosciuti", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, expiredMarked: 1 });
    expect(mockedRun).toHaveBeenCalledWith(expect.objectContaining({ mode: "dry-run", deleteUnknown: false }));
  });

  it("legge modalità ed eliminazione degli sconosciuti dall'ambiente", async () => {
    vi.stubEnv("GOCARDLESS_CLEANUP_MODE", "execute");
    vi.stubEnv("GOCARDLESS_CLEANUP_DELETE_UNKNOWN", "true");
    await call(`Bearer ${SECRET}`);
    expect(mockedRun).toHaveBeenCalledWith(expect.objectContaining({ mode: "execute", deleteUnknown: true }));
  });

  it("un valore sconosciuto della modalità ricade su dry-run, mai su execute", async () => {
    vi.stubEnv("GOCARDLESS_CLEANUP_MODE", "esegui");
    await call(`Bearer ${SECRET}`);
    expect(mockedRun).toHaveBeenCalledWith(expect.objectContaining({ mode: "dry-run" }));
  });

  it("risponde 500 se qualche operazione fallisce o se la manutenzione lancia", async () => {
    mockedRun.mockResolvedValue({ ...OK_RESULT, failed: 1 });
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
    mockedRun.mockRejectedValue(new Error("DB giù"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
