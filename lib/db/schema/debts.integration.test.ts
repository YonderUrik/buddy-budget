import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { debtEvents, debts } from "@/lib/db/schema/debts";

describe("schema debiti", () => {
  let userId: string;
  let debtId: string;

  beforeEach(async () => {
    const [user] = await db
      .insert(authUser)
      .values({
        id: `test-debts-schema-${crypto.randomUUID()}`,
        name: "Test Debiti",
        email: `test-debts-schema-${crypto.randomUUID()}@example.com`,
        emailVerified: false,
      })
      .returning();
    userId = user.id;
    const [debt] = await db
      .insert(debts)
      .values({
        userId,
        name: "Prestito personale",
        startMode: "origine",
        principal: "10000.00",
        annualRate: "6.5000",
        installments: 36,
        firstInstallmentDate: "2026-03-05",
      })
      .returning();
    debtId = debt.id;
  });

  afterEach(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
  });

  afterAll(async () => {
    await client.end();
  });

  it("salva un debito con i default (tipo loan, nessuna spesa accessoria)", async () => {
    const [debt] = await db.select().from(debts).where(eq(debts.id, debtId));
    expect(debt.kind).toBe("loan");
    expect(debt.costs).toEqual([]);
    expect(debt.installment).toBeNull();
  });

  it("ammette una sola rata pagata per numero di rata", async () => {
    await db.insert(debtEvents).values({ debtId, userId, type: "payment", date: "2026-03-05", amount: "306.00", installmentNumber: 1 });
    await expect(
      db.insert(debtEvents).values({ debtId, userId, type: "payment", date: "2026-03-06", amount: "306.00", installmentNumber: 1 })
    ).rejects.toThrow();
  });

  it("non limita gli altri eventi con lo stesso numero di rata vuoto", async () => {
    await db.insert(debtEvents).values({ debtId, userId, type: "rate_change", date: "2026-06-01", rate: "7.2000" });
    await db.insert(debtEvents).values({ debtId, userId, type: "rate_change", date: "2026-09-01", rate: "7.8000" });
    const rows = await db.select().from(debtEvents).where(eq(debtEvents.debtId, debtId));
    expect(rows).toHaveLength(2);
  });

  it("cancella debiti ed eventi insieme all'utente", async () => {
    await db.insert(debtEvents).values({ debtId, userId, type: "payment", date: "2026-03-05", amount: "306.00", installmentNumber: 1 });
    await db.delete(authUser).where(eq(authUser.id, userId));
    expect(await db.select().from(debts).where(eq(debts.id, debtId))).toHaveLength(0);
    expect(await db.select().from(debtEvents).where(eq(debtEvents.debtId, debtId))).toHaveLength(0);
  });
});
