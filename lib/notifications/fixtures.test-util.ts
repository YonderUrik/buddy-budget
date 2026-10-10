import type { Budget } from "@/lib/db/schema/budgets";
import type { Category } from "@/lib/db/schema/categories";
import type { Transaction } from "@/lib/db/schema/transactions";

/** Fixture per i test delle notifiche (nessun accesso a DB). */
export function makeTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    accountId: "account-1",
    categoryId: "cat-food",
    description: "Transazione",
    rawDescription: null,
    merchantCategoryCode: null,
    note: null,
    amount: "-10.00",
    excludedAmount: "0.00",
    date: "2026-09-10",
    source: "manuale",
    externalId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "cat-food",
    userId: "user-1",
    name: "Spesa alimentare",
    type: "dovuta",
    color: "green",
    icon: "shopping-cart",
    isFallback: false,
    createdAt: new Date(),
    ...overrides,
  };
}

export function makeBudget(overrides: Partial<Budget>): Budget {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    categoryId: "cat-food",
    monthlyAmount: "300.00",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
