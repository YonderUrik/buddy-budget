import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, after } from "next/server";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { redis } from "@/lib/redis/client";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: vi.fn() }));
vi.mock("@/lib/categorization/ai/run-generation", () => ({ runGeneration: vi.fn() }));
import { auth } from "@/lib/auth";
import { runGeneration } from "@/lib/categorization/ai/run-generation";
import { writeGenerationJob } from "@/lib/categorization/ai/generation-store";
import { GET, POST } from "./route";
const request = (method = "GET") => new NextRequest("http://localhost/api/transactions/categorize-suggestions/generate", { method });
let user: string;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
  user = `test-generation-route-${crypto.randomUUID()}`;
  await db.insert(authUser).values({ id: user, name: "Test", email: `${user}@example.com`, aiCategorizationConsentAt: new Date() });
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: user } } as never);
});
afterEach(async () => {
  await redis.del(`categorization-generation:${user}`);
  await db.delete(authUser).where(eq(authUser.id, user));
  vi.unstubAllEnvs();
});
afterAll(async () => { await client.end(); await redis.quit(); });
describe("manual generation API", () => {
  it("requires authentication for reads and starts", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request("POST"))).status).toBe(401);
    expect(after).not.toHaveBeenCalled();
  });
  it("checks key and consent before creating work", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(await (await POST(request("POST"))).json()).toEqual({ status: "no_key" });
    vi.stubEnv("OPENROUTER_API_KEY", "test-only-key");
    await db.update(authUser).set({ aiCategorizationConsentAt: null }).where(eq(authUser.id, user));
    expect(await (await POST(request("POST"))).json()).toEqual({ status: "disabled" });
    expect(after).not.toHaveBeenCalled();
  });
  it("starts once, resumes duplicate clicks, and exposes real zero-result completion", async () => {
    const first = await (await POST(request("POST"))).json();
    const second = await (await POST(request("POST"))).json();
    expect(first.status).toBe("started");
    expect(second.jobId).toBe(first.jobId);
    expect(after).toHaveBeenCalledTimes(1);
    const callback = vi.mocked(after).mock.calls[0][0] as () => Promise<void>;
    await callback();
    expect(runGeneration).toHaveBeenCalledWith(user, expect.objectContaining({ id: first.jobId }), expect.anything());
    await writeGenerationJob(user, { ...first.job, status: "done", blocked: 12 });
    const response = await GET(request());
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ job: { status: "done", stored: 0, blocked: 12 } });
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: `${user}-other` } } as never);
    expect(await (await GET(request())).json()).toEqual({ job: null });
  });
});
