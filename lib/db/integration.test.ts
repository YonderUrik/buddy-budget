import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { client, db } from "./client";
import { accounts } from "./schema/accounts";
import { budgets } from "./schema/budgets";
import { categories } from "./schema/categories";
import { isValidExcludedAmount, transactions } from "./schema/transactions";
import { users } from "./schema/users";

describe("modello dati base — round trip end-to-end", () => {
  let userId: string;

  afterAll(async () => {
    if (userId) {
      await db.delete(users).where(eq(users.id, userId));
    }
    await client.end();
  });

  it("crea utente, categoria, conto, transazione con Dividi e budget, e li rilegge correttamente", async () => {
    const [user] = await db.insert(users).values({ currency: "EUR" }).returning();
    userId = user.id;
    expect(user.currency).toBe("EUR");

    const [category] = await db
      .insert(categories)
      .values({ userId, name: "Spesa alimentare", type: "variabile" })
      .returning();

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto corrente", type: "corrente", balance: "1000.00" })
      .returning();
    expect(account.source).toBe("manuale");

    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        accountId: account.id,
        categoryId: category.id,
        description: "Spesa al supermercato",
        amount: "-50.00",
        excludedAmount: "-10.00",
        date: "2026-07-01",
      })
      .returning();

    expect(transaction.amount).toBe("-50.00");
    expect(transaction.excludedAmount).toBe("-10.00");
    expect(isValidExcludedAmount(Number(transaction.amount), Number(transaction.excludedAmount))).toBe(true);

    const [budget] = await db
      .insert(budgets)
      .values({ userId, categoryId: category.id, monthlyAmount: "300.00" })
      .returning();
    expect(budget.monthlyAmount).toBe("300.00");

    const storedTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));
    expect(storedTransactions).toHaveLength(1);
  });

  it("cancellando l'utente cancella a cascata categorie, conti, transazioni e budget", async () => {
    const [user] = await db.insert(users).values({ currency: "EUR" }).returning();

    const [category] = await db
      .insert(categories)
      .values({ userId: user.id, name: "Trasporti", type: "variabile" })
      .returning();
    const [account] = await db
      .insert(accounts)
      .values({ userId: user.id, name: "Contanti", type: "contanti", balance: "50.00" })
      .returning();
    await db.insert(transactions).values({
      userId: user.id,
      accountId: account.id,
      categoryId: category.id,
      description: "Biglietto bus",
      amount: "-2.50",
      date: "2026-07-02",
    });
    await db.insert(budgets).values({ userId: user.id, categoryId: category.id, monthlyAmount: "50.00" });

    await db.delete(users).where(eq(users.id, user.id));

    const remainingCategories = await db.select().from(categories).where(eq(categories.userId, user.id));
    const remainingAccounts = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    const remainingTransactions = await db.select().from(transactions).where(eq(transactions.userId, user.id));
    const remainingBudgets = await db.select().from(budgets).where(eq(budgets.userId, user.id));

    expect(remainingCategories).toHaveLength(0);
    expect(remainingAccounts).toHaveLength(0);
    expect(remainingTransactions).toHaveLength(0);
    expect(remainingBudgets).toHaveLength(0);
  });
});
