import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/redis-ops-store", async () => {
  const { createMemoryOpsKv, createOpsStore } = await import("@/lib/observability/ops-store");
  return { redisOpsStore: createOpsStore(createMemoryOpsKv()) };
});
vi.mock("@/lib/public-demo/reset", () => ({ resetPublicDemos: vi.fn() }));

import { resetPublicDemos } from "@/lib/public-demo/reset";
import { GET } from "./route";

const SECRET = "s".repeat(40);
const mockedReset = vi.mocked(resetPublicDemos);

function call(authorization?: string) {
  return GET(new NextRequest("http://localhost/api/cron/public-demo", { headers: authorization ? { authorization } : undefined }));
}

describe("GET /api/cron/public-demo", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("PUBLIC_DEMO_ENABLED", "true");
    mockedReset.mockReset().mockResolvedValue({ rebuilt: ["it", "en", "de"], failed: [] });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers 401 without the secret and does nothing", async () => {
    expect((await call()).status).toBe(401);
    expect(mockedReset).not.toHaveBeenCalled();
  });

  it("does nothing while the demo is off", async () => {
    vi.stubEnv("PUBLIC_DEMO_ENABLED", "");
    const response = await call(`Bearer ${SECRET}`);
    expect(await response.json()).toEqual({ ok: true, skipped: true });
    expect(mockedReset).not.toHaveBeenCalled();
  });

  it("rebuilds every language", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, rebuilt: ["it", "en", "de"] });
  });

  it("fails when a language could not be rebuilt", async () => {
    mockedReset.mockResolvedValue({ rebuilt: ["it", "de"], failed: ["en"] });
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, failed: ["en"] });
  });
});
