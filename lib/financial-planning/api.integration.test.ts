import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
vi.mock("@/lib/account/route-session", () => ({ sessionOrUnauthorized: vi.fn(), readJson: (r: Request) => r.json().catch(() => null) }));
import { sessionOrUnauthorized } from "@/lib/account/route-session";
import { GET, PUT } from "@/app/api/financial-planning/route";
import { db, client } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { financialPlans } from "@/lib/db/schema/financial-plans";
import { germanPlanSchema } from ".";
const users = [randomUUID(), randomUUID()];
function session(userId = users[0], productCountry = "DE") {
  vi.mocked(sessionOrUnauthorized).mockResolvedValue({ user: { id: userId, productCountry, language: "en" } } as Awaited<ReturnType<typeof sessionOrUnauthorized>>);
}
const get = () => GET(new Request("http://localhost/api/financial-planning"));
const put = (body: unknown) => PUT(new Request("http://localhost/api/financial-planning", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
beforeAll(async () => { await db.insert(authUser).values(users.map(id => ({ id, email: `${id}@example.test`, name: "Planning test", productCountry: "DE", language: "en" }))); });
afterAll(async () => { await db.delete(authUser).where(inArray(authUser.id, users)); await client.end(); });
describe("country financial plan persistence", () => {
  it("requires authentication and a supported country", async () => {
    vi.mocked(sessionOrUnauthorized).mockResolvedValue(new Response(null, { status: 401 })); expect((await get()).status).toBe(401);
    session(users[0], "IT"); expect((await get()).status).toBe(403); expect((await put({})).status).toBe(403);
  });
  it("validates before saving, persists and isolates by user", async () => {
    session(); expect((await put({ plan: { country: "IT" }, revision: 0 })).status).toBe(400);
    expect((await put({ plan: { tax: { year: 2027 } }, revision: 0 })).status).toBe(400);
    const initial = await (await get()).json(); expect(initial.revision).toBe(0);
    const plan = germanPlanSchema.parse({ tax: { shareLosses: 1234 } });
    expect((await put({ plan, revision: 0 })).status).toBe(200);
    const saved = await (await get()).json(); expect(saved.plan.tax.shareLosses).toBe(1234); expect(saved.revision).toBe(1);
    session(users[1]); const other = await (await get()).json(); expect(other.plan.tax.shareLosses).toBe(0); expect(other.revision).toBe(0);
  });
  it("rejects stale writes instead of overwriting another tab", async () => {
    session(); const response = await put({ plan: germanPlanSchema.parse({}), revision: 0 }); expect(response.status).toBe(409);
    expect((await (await get()).json()).plan.tax.shareLosses).toBe(1234);
  });
  it("has exactly one successful concurrent update at the same revision", async () => {
    session(); const body = { plan: germanPlanSchema.parse({}), revision: 1 };
    const results = await Promise.all([put(body), put(body)]); expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await db.select().from(financialPlans).where(eq(financialPlans.userId, users[0])))[0].revision).toBe(2);
  });
});
