import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/redis-ops-store", async () => {
  const { createMemoryOpsKv, createOpsStore } = await import("@/lib/observability/ops-store");
  return { redisOpsStore: createOpsStore(createMemoryOpsKv()) };
});
vi.mock("@/lib/market-data/update", () => ({ updateHeldInstruments: vi.fn() }));
vi.mock("@/lib/market-data/runtime", () => ({
  marketDataDeps: vi.fn(() => ({})),
  refreshCryptoCatalogOnProviders: vi.fn(async () => 500),
}));
vi.mock("@/lib/market-data/inflation", () => ({ updateInflationIndex: vi.fn(async () => 36) }));
vi.mock("@/lib/market-data/rates", () => ({ updateRiskFreeRates: vi.fn(async () => 21) }));
vi.mock("@/lib/market-data/store", () => ({ findHeldAutoInstruments: vi.fn(async () => []) }));
vi.mock("@/lib/market-data/dividends", () => ({
  refreshStaleDividends: vi.fn(async () => ({ candidates: 1, saved: 1, empty: 0, failed: 0 })),
}));
vi.mock("@/lib/market-data/profiles", () => ({
  refreshStaleProfiles: vi.fn(async () => ({ candidates: 2, saved: 1, empty: 1, failed: 0 })),
}));

import { refreshCryptoCatalogOnProviders } from "@/lib/market-data/runtime";
import { updateHeldInstruments } from "@/lib/market-data/update";
import { redisOpsStore } from "@/lib/observability/redis-ops-store";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedUpdate = vi.mocked(updateHeldInstruments);
const SUMMARY = { instruments: 3, updated: 2, fromFallback: 1, failed: 1, suspect: 0, fxRates: 5 };

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost/api/cron/market-prices", { headers }));
}

describe("GET /api/cron/market-prices", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    mockedUpdate.mockReset().mockResolvedValue(SUMMARY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("risponde 401 senza segreto e non aggiorna nulla", async () => {
    expect((await call()).status).toBe(401);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("aggiorna, risponde coi soli conteggi e registra l'ultimo successo", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      ...SUMMARY,
      inflationMonths: 36,
      riskFreeDays: 21,
      profiles: { candidates: 2, saved: 1, empty: 1, failed: 0 },
    });
    expect((await redisOpsStore.getCronSuccesses()).market_prices).toEqual(expect.any(Number));
  });

  it("non fallisce se il rinnovo del catalogo crypto viene rifiutato", async () => {
    vi.mocked(refreshCryptoCatalogOnProviders).mockRejectedValueOnce(new Error("rate limited"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(200);
  });

  it("risponde 500 se l'aggiornamento lancia", async () => {
    mockedUpdate.mockRejectedValue(new Error("DB giù"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
