import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { auth } from "@/lib/auth";
import { db, client } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories, DEFAULT_CATEGORIES } from "@/lib/db/schema/categories";
import { PATCH } from "./settings/route";
import { GET as pension } from "../pension/route";
import { localizeStarterCategories } from "@/lib/localization/categories.server";
const id = `test-localization-${crypto.randomUUID()}`;
async function signIn() {
  const [user] = await db.select().from(authUser).where(eq(authUser.id, id));
  vi.mocked(auth.api.getSession).mockResolvedValue({ user, session: { createdAt: new Date() } } as never);
  return user;
}
const update = (body: object) => PATCH(new NextRequest("http://localhost/api/user/settings", { method: "PATCH", body: JSON.stringify(body) }));
beforeAll(async () => { await db.insert(authUser).values({ id, name: "Locale test", email: `${id}@example.invalid` }); });
afterAll(async () => { await db.delete(authUser).where(eq(authUser.id, id)); await client.end(); });
it("persists only supported pairs and preserves data across country switches", async () => {
  await signIn();
  expect((await update({ productCountry: "IT", language: "en" })).status).toBe(204);
  expect(await signIn()).toMatchObject({ productCountry: "IT", language: "en" });
  expect((await update({ language: "de" })).status).toBe(400);
  expect((await update({ productCountry: "DE", language: "de" })).status).toBe(204);
  await signIn();
  expect((await pension(new NextRequest("http://localhost/api/pension"))).status).toBe(403);
  await db.insert(categories).values({ userId: id, name: "My custom category", type: "voluta" });
  expect((await update({ productCountry: "IT", language: "en" })).status).toBe(204);
  await signIn();
  expect((await pension(new NextRequest("http://localhost/api/pension"))).status).toBe(200);
  expect((await db.select().from(categories).where(eq(categories.userId, id)))[0].name).toBe("My custom category");
});
it("localises untouched starter categories but preserves custom categories", async () => {
  await db.insert(categories).values(DEFAULT_CATEGORIES.map(category => ({ userId: id, name: category.name, type: category.type, color: category.color, icon: category.icon, description: category.description, isFallback: category.isFallback })));
  await localizeStarterCategories(id, { productCountry: "DE", language: "de" });
  const rows = await db.select().from(categories).where(eq(categories.userId, id));
  expect(rows.find(c => c.name === "Steuern & Abgaben")?.description).toBe("Steuern und Abgaben");
  expect(rows.find(c => c.isFallback)?.name).toBe("Zu kategorisieren");
  expect(rows.some(c => c.name === "My custom category")).toBe(true);
});
