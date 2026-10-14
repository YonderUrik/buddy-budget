import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { transactions, type CategorySource } from "@/lib/db/schema/transactions";

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

import { auth } from "@/lib/auth";
import { GET, POST } from "./route";
import { POST as undo } from "./undo/route";

const mockedGetSession = vi.mocked(auth.api.getSession);

describe("«Ricategorizza»: GET/POST /api/transactions/recategorize e POST …/undo", () => {
  let userId: string;
  let accountId: string;
  let spesaId: string;
  let casaId: string;
  let ruleId: string;

  async function insertRow(source: CategorySource | null, description = "ESSELUNGA") {
    const [row] = await db
      .insert(transactions)
      .values({
        userId,
        accountId,
        categoryId: spesaId,
        description,
        amount: "-30.00",
        date: "2026-10-01",
        source: "manuale",
        categorySource: source,
        categorizedAt: source ? new Date("2026-10-02T08:00:00Z") : null,
      })
      .returning();
    return row;
  }

  async function categoryOf(id: string) {
    const [row] = await db.select().from(transactions).where(eq(transactions.id, id));
    return { categoryId: row.categoryId, source: row.categorySource };
  }

  function preview(query = "") {
    return GET(new NextRequest(`http://localhost/api/transactions/recategorize${query}`));
  }

  function apply(body: unknown) {
    return POST(new NextRequest("http://localhost/api/transactions/recategorize", { method: "POST", body: JSON.stringify(body) }));
  }

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-recategorize-${crypto.randomUUID()}`,
        name: "Test",
        email: `test-recategorize-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;
    mockedGetSession.mockResolvedValue({ user: { id: userId } } as never);
    const [account] = await db.insert(accounts).values({ userId, name: "Conto", type: "Contanti", balance: "0.00" }).returning();
    accountId = account.id;
    await db.insert(categories).values({ userId, name: "Da categorizzare", type: "voluta", isFallback: true });
    const [spesa] = await db.insert(categories).values({ userId, name: "Spesa", type: "dovuta" }).returning();
    const [casa] = await db.insert(categories).values({ userId, name: "Casa", type: "dovuta" }).returning();
    spesaId = spesa.id;
    casaId = casa.id;
    const [rule] = await db.insert(categorizationRules).values({ userId, matchType: "merchant", pattern: "esselunga", categoryId: casaId }).returning();
    ruleId = rule.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("risponde 401 senza sessione", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await preview()).status).toBe(401);
  });

  it("mostra cosa cambierebbe senza scrivere, e quanti più vecchi entrerebbero", async () => {
    const auto = await insertRow("regola");
    await insertRow("utente");
    await insertRow(null);

    const body = await (await preview()).json();
    expect(body.changes).toBe(1);
    expect(body.legacyAvailable).toBe(1);
    expect(body.groups).toEqual([expect.objectContaining({ fromCategoryId: spesaId, toCategoryId: casaId, source: "regola", count: 1 })]);
    expect(body.lastRun).toBeNull();
    expect((await categoryOf(auto.id)).categoryId).toBe(spesaId);

    const withLegacy = await (await preview("?legacy=1")).json();
    expect(withLegacy.changes).toBe(2);
    expect(withLegacy.legacyChanges).toBe(1);
  });

  it("sposta solo i movimenti messi da soli, e l'annulla li rimette com'erano", async () => {
    const auto = await insertRow("regola");
    const other = await insertRow("storico");
    const mine = await insertRow("utente");
    const legacy = await insertRow(null);

    const response = await apply({ scope: "tutto" });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.changed).toBe(2);
    expect(await categoryOf(auto.id)).toEqual({ categoryId: casaId, source: "regola" });
    expect(await categoryOf(mine.id)).toEqual({ categoryId: spesaId, source: "utente" });
    expect(await categoryOf(legacy.id)).toEqual({ categoryId: spesaId, source: null });

    // Una scelta fatta dopo dall'utente resta anche dopo l'annulla.
    await db.update(transactions).set({ categoryId: spesaId, categorySource: "utente", categorizedAt: new Date() }).where(eq(transactions.id, other.id));

    const { lastRun } = await (await preview()).json();
    expect(lastRun).toMatchObject({ id: result.runId, changed: 2 });
    const undone = await undo(new NextRequest("http://localhost/api/transactions/recategorize/undo", { method: "POST", body: JSON.stringify({ runId: result.runId }) }));
    expect(await undone.json()).toEqual({ restored: 1 });
    expect(await categoryOf(auto.id)).toEqual({ categoryId: spesaId, source: "regola" });
    expect(await categoryOf(other.id)).toEqual({ categoryId: spesaId, source: "utente" });

    const again = await undo(new NextRequest("http://localhost/api/transactions/recategorize/undo", { method: "POST", body: JSON.stringify({ runId: result.runId }) }));
    expect(again.status).toBe(404);
  });

  it("applica solo i gruppi scelti e, per una regola, anche i movimenti più vecchi", async () => {
    const auto = await insertRow("regola");
    const legacy = await insertRow(null);
    expect((await (await apply({ scope: "tutto", groupKeys: ["altro"] })).json()).changed).toBe(0);

    const result = await (await apply({ scope: "regola", ruleId })).json();
    expect(result.changed).toBe(2);
    expect((await categoryOf(auto.id)).categoryId).toBe(casaId);
    expect(await categoryOf(legacy.id)).toEqual({ categoryId: casaId, source: "regola" });
  });

  it("rifiuta una richiesta per una regola senza regola", async () => {
    expect((await apply({ scope: "regola" })).status).toBe(400);
  });
});
