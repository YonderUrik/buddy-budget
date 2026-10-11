import { NextRequest } from "next/server";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { categorizationSuggestions } from "@/lib/db/schema/categorization-suggestions";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { auth } from "@/lib/auth";
import { GET, PATCH } from "./route";
const id = `test-ai-instructions-${crypto.randomUUID()}`;
const otherId = `${id}-other`;
const req = (body?: unknown) => new NextRequest("http://localhost/api/user/ai-categorization", body === undefined ? {} : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeAll(async () => {
  await db.insert(authUser).values([{ id, name: "Test", email: `${id}@example.com` }, { id: otherId, name: "Other", email: `${otherId}@example.com` }]);
  vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id } } as never);
  const [category] = await db.insert(categories).values({ userId: id, name: "Spesa", type: "voluta" }).returning();
  await db.insert(categorizationSuggestions).values([
    { userId: id, merchantKey: "pending", direction: "uscita", categoryId: category.id, confidence: "0.8", status: "in_attesa" },
    { userId: id, merchantKey: "confirmed", direction: "uscita", categoryId: category.id, confidence: "0.8", status: "confermata" },
    { userId: otherId, merchantKey: "other", direction: "uscita", categoryId: category.id, confidence: "0.8", status: "in_attesa" },
  ]);
});
afterAll(async () => {
  await db.delete(authUser).where(eq(authUser.id, otherId));
  await db.delete(authUser).where(eq(authUser.id, id));
  await client.end();
});
it("salva istruzioni senza attivare il consenso e invalida solo le proposte in attesa proprie", async () => {
  const result = await PATCH(req({ instructions: "  Libri in Svago  " }));
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ enabled: false, instructions: "Libri in Svago" });
  const own = await db.select().from(categorizationSuggestions).where(eq(categorizationSuggestions.userId, id));
  expect(own.map((r) => r.status)).toEqual(["confermata"]);
  expect(await db.select().from(categorizationSuggestions).where(eq(categorizationSuggestions.userId, otherId))).toHaveLength(1);
  expect(await (await GET(req())).json()).toMatchObject({ instructions: "Libri in Svago" });
});
it("modificare il consenso conserva le istruzioni", async () => {
  const response = await PATCH(req({ enabled: true }));
  expect(await response.json()).toMatchObject({ enabled: true, instructions: "Libri in Svago" });
});
it("rifiuta istruzioni troppo lunghe", async () => {
  expect((await PATCH(req({ instructions: "a".repeat(2001) }))).status).toBe(400);
});
it("consente di rimuovere le istruzioni", async () => {
  expect(await (await PATCH(req({ instructions: "" }))).json()).toMatchObject({ instructions: "", enabled: true });
});
it("richiede autenticazione", async () => {
  vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
  expect((await PATCH(req({ instructions: "x" }))).status).toBe(401);
});
