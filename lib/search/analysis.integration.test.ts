import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { cleanAnalysis } from "@/lib/commands/analysis";

vi.mock("server-only", () => ({}));
const { analysisSchema } = await import("@/lib/commands/analysis-schema");
const { answerAnalysis } = await import("./analysis");

const TODAY = "2026-11-03";
const OPTIONS = { windowStart: "2024-11-03", scanLimit: 6000, today: TODAY };
const [alice, bob] = ["alice", "bob"].map((name) => `test-analysis-${name}-${crypto.randomUUID()}`);

/** One user with an account, a grocery category described as a supermarket, a leisure one and the given movements. */
async function seed(userId: string, movements: { description: string; date: string; amount: string; grocery?: boolean }[]) {
  await db.insert(authUser).values({ id: userId, name: "Analysis test", email: `${userId}@example.test`, emailVerified: false, currency: "EUR" });
  const [account] = await db.insert(accounts).values({ userId, name: "Conto corrente", type: "Conto corrente", balance: "1000.00", source: "manuale" }).returning();
  const [grocery, leisure] = await db
    .insert(categories)
    .values([
      { userId, name: "Spesa", type: "dovuta", description: "Supermercato, alimentari, prodotti per la casa" },
      { userId, name: "Svago", type: "voluta" },
    ])
    .returning();
  await db.insert(transactions).values(movements.map((m) => ({ userId, accountId: account.id, categoryId: m.grocery ? grocery.id : leisure.id, description: m.description, amount: m.amount, date: m.date, source: "manuale" as const })));
}

const ask = (userId: string, raw: Record<string, unknown>) => answerAnalysis(userId, cleanAnalysis(analysisSchema.parse(raw), { language: "it", today: TODAY }), OPTIONS);

beforeAll(async () => {
  await seed(alice, [
    { description: "Esselunga", date: "2026-10-04", amount: "-80.00", grocery: true },
    { description: "Esselunga", date: "2026-09-12", amount: "-60.00", grocery: true },
    { description: "Coop", date: "2026-08-20", amount: "-40.00", grocery: true },
    { description: "Cinema", date: "2026-10-10", amount: "-12.00" },
  ]);
  await seed(bob, [{ description: "Esselunga", date: "2026-10-05", amount: "-999.00", grocery: true }]);
});

afterAll(async () => {
  await db.delete(authUser).where(inArray(authUser.id, [alice, bob]));
  await client.end();
});

describe("answerAnalysis", () => {
  it("finds a category by what its description lists and sums only the user's own movements", async () => {
    const { hit } = await ask(alice, { type: "analisi", measure: "somma", direction: "uscite", category: "supermercato" });
    expect(hit.answer).toMatchObject({ kind: "analisi", names: { category: "Spesa" }, result: { value: 180, count: 3 } });
    expect(hit.href).toMatch(/^\/liquidita\?categoria=[0-9a-f-]{36}/);
  });

  it("splits a merchant's movements by month in time order, decrypting within the window", async () => {
    const { hit } = await ask(alice, { type: "analisi", measure: "somma", text: "Esselunga", groupBy: "mese", from: "2026-08-01", to: "2026-10-31" });
    const result = hit.answer?.kind === "analisi" ? hit.answer.result : null;
    expect(result).toMatchObject({ value: 140, count: 2, rowsKind: "serie" });
    expect(result?.rows.map((row) => row.value)).toEqual([0, 60, 80]);
  });

  it("gives no figure for an account the user does not have", async () => {
    const { hit } = await ask(alice, { type: "analisi", measure: "somma", account: "Conto segreto di Bob" });
    expect(hit.answer).toMatchObject({ names: { missingAccount: "conto segreto di bob" }, result: { value: null, count: 0 } });
  });
});
