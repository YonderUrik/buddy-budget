import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/observability", () => ({ bindRequestUser: vi.fn(), requestLogger: () => ({ info: vi.fn(), warn: vi.fn() }), withRoute: (_name: string, handler: unknown) => handler }));
import { auth } from "@/lib/auth";
import { POST } from "./route";
import { IBKR_MAX_FILE_BYTES } from "@/lib/investments/import/interactive-brokers";

const fixture = readFileSync(new URL("../../../../../lib/investments/import/__fixtures__/interactive-brokers.csv", import.meta.url), "utf8");
const request = (body: string, type = "text/csv") => new NextRequest("http://localhost/api/investments/import/parse", { method: "POST", headers: { "Content-Type": type }, body });

beforeEach(() => {
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "test-parser" } } as never);
});

describe("POST /api/investments/import/parse", () => {
  it("requires authentication", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    expect((await POST(request(fixture))).status).toBe(401);
  });
  it("returns all statement data and normalized operations without caching", async () => {
    const response = await POST(request(fixture, "text/csv; charset=utf-8"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.operations).toHaveLength(3);
    expect(body.records.some((r: { section: string }) => r.section === "Future Section")).toBe(true);
  });
  it("rejects unsupported media types, empty and invalid files", async () => {
    expect((await POST(request("{}", "application/json"))).status).toBe(415);
    expect((await POST(request(""))).status).toBe(400);
    expect((await POST(request("Date,Amount\n2025-01-01,10"))).status).toBe(400);
    expect((await POST(request(fixture + 'a,"broken'))).status).toBe(400);
  });
  it("limits the actual body without relying on Content-Length", async () => {
    expect((await POST(request("x".repeat(IBKR_MAX_FILE_BYTES + 1)))).status).toBe(413);
  });
});
