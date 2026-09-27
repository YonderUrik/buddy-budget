import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/scrape-deps", () => ({
  createScrapeDeps: () => ({ dependencies: async () => ({ postgres: true, redis: true }) }),
}));

import { GET } from "./route";

const TOKEN = "m".repeat(40);

function call(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return GET(new NextRequest("http://localhost/api/metrics", { headers }));
}

describe("GET /api/metrics", () => {
  beforeEach(() => vi.stubEnv("METRICS_TOKEN", TOKEN));
  afterEach(() => vi.unstubAllEnvs());

  it("risponde 404 se METRICS_TOKEN non è configurato", async () => {
    vi.stubEnv("METRICS_TOKEN", "");
    expect((await call(`Bearer ${TOKEN}`)).status).toBe(404);
  });

  it("risponde 401 senza token o con token sbagliato", async () => {
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer ${"x".repeat(40)}`)).status).toBe(401);
  });

  it("restituisce le metriche in formato Prometheus col token giusto", async () => {
    const response = await call(`Bearer ${TOKEN}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).toContain("buddybudget_build_info");
    expect(body).toContain('buddybudget_dependency_up{dependency="postgres"} 1');
  });
});
