import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ client: vi.fn() }));
vi.mock("@/lib/redis/client", () => ({ redis: { ping: vi.fn() } }));

import { client } from "@/lib/db/client";
import { redis } from "@/lib/redis/client";
import { GET } from "./route";

const mockedClient = vi.mocked(client as unknown as (...args: unknown[]) => Promise<unknown>);
const mockedPing = vi.mocked(redis.ping);

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    mockedClient.mockReset().mockResolvedValue([{ "?column?": 1 }]);
    mockedPing.mockReset().mockResolvedValue("PONG");
  });

  it("risponde 200 quando Postgres e Redis rispondono", async () => {
    const response = await GET(new Request("http://localhost/api/health/ready"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true, checks: { database: "ok", redis: "ok" } });
  });

  it("risponde 503 senza dettagli d'errore quando Redis è giù", async () => {
    mockedPing.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:6379"));
    const response = await GET(new Request("http://localhost/api/health/ready"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ ready: false, checks: { database: "ok", redis: "error" } });
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
