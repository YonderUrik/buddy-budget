import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { defaultCategoryRows } from "./seed";
import { buildCategoryProposal, type CategorySetupItem } from "./setup";
import { applyCategorySetup } from "./setup.server";

const userIds: string[] = [];

async function makeUser(): Promise<string> {
  const id = `setup-test-${crypto.randomUUID()}`;
  userIds.push(id);
  await db.insert(authUser).values({ id, name: "Setup", email: `${id}@example.com` });
  await db.insert(categories).values(defaultCategoryRows(id));
  return id;
}

const proposal = (): CategorySetupItem[] => buildCategoryProposal().map(({ key, name, type, enabled }) => ({ key, name, type, enabled }));
const names = async (userId: string) =>
  (await db.select({ name: categories.name }).from(categories).where(eq(categories.userId, userId))).map((row) => row.name).sort();

afterAll(async () => {
  if (userIds.length) await db.delete(authUser).where(inArray(authUser.id, userIds));
  await client.end();
});

describe("applyCategorySetup", () => {
  it("applica tolte, rinomine (anche scambiate), facoltative e aggiunte, con le descrizioni", async () => {
    const userId = await makeUser();
    const items = proposal().map((item) => {
      if (item.key === "contanti") return { ...item, enabled: false };
      if (item.key === "spesa") return { ...item, name: "Salute" };
      if (item.key === "salute") return { ...item, name: "Spesa" };
      if (item.key === "animali") return { ...item, enabled: true };
      return item;
    });
    items.push({ key: null, name: "Musica", type: "voluta", enabled: true });

    const result = await applyCategorySetup(userId, items);
    expect(result).toEqual({ outcome: "applied", deleted: 1, updated: 2, created: 2 });
    const after = await names(userId);
    expect(after).toContain("Animali");
    expect(after).toContain("Musica");
    expect(after).toContain("Da categorizzare");
    expect(after).not.toContain("Contanti");
    expect(after).toHaveLength(26);
    const [animali] = await db.select().from(categories).where(eq(categories.name, "Animali"));
    expect(animali.description).toMatch(/veterinario/);
  });

  it("non tocca nulla se la proposta è confermata o se ci sono già movimenti", async () => {
    const userId = await makeUser();
    expect(await applyCategorySetup(userId, proposal())).toEqual({ outcome: "skipped", reason: "unchanged" });

    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Conto corrente" }).returning();
    const before = await names(userId);
    const [spesa] = await db.select().from(categories).where(eq(categories.name, "Spesa"));
    await db.insert(transactions).values({ userId, accountId: account.id, categoryId: spesa.id, description: "Super", amount: "-10.00", date: "2026-10-01", source: "manuale" });
    const items = proposal().map((item) => (item.key === "spesa" ? { ...item, enabled: false } : item));
    expect(await applyCategorySetup(userId, items)).toEqual({ outcome: "skipped", reason: "has_transactions" });
    expect(await names(userId)).toEqual(before);
  });

  it("scarta scelte non valide", async () => {
    const userId = await makeUser();
    const items = proposal().map((item) => (item.key === "spesa" ? { ...item, name: "Da categorizzare" } : item));
    expect(await applyCategorySetup(userId, items)).toEqual({ outcome: "skipped", reason: "invalid" });
  });
});
