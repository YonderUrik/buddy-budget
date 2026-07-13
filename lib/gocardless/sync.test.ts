import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions } from "@/lib/db/schema/transactions";
import type { RateLimitStore } from "./rate-limit";

vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, getAccountBalances: vi.fn(), getAccountTransactions: vi.fn() };
});

import { getAccountBalances, getAccountTransactions, GoCardlessError } from "./client";
import { syncAccountLink, type SyncableLink } from "./sync";

function createMemoryStore(): RateLimitStore {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

describe("syncAccountLink", () => {
  let userId: string;
  let link: SyncableLink;

  beforeEach(async () => {
    const testId = `test-sync-${crypto.randomUUID()}`;
    const [user] = await db
      .insert(authUser)
      .values({
        id: testId,
        name: "Test Sync",
        email: `test-sync-${Date.now()}@example.com`,
        emailVerified: false,
        currency: "EUR",
      })
      .returning();
    userId = user.id;

    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto Auto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, institutionId: "INST_1", institutionName: "Banca Test", status: "linked" })
      .returning();
    const [linkRow] = await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "ext-1" })
      .returning();

    link = {
      linkId: linkRow.id,
      connectionId: connection.id,
      accountId: account.id,
      externalAccountId: "ext-1",
      userId,
    };

    vi.mocked(getAccountBalances).mockReset();
    vi.mocked(getAccountTransactions).mockReset();
  });

  afterAll(async () => {
    await db.delete(authUser).where(eq(authUser.id, userId));
    await client.end();
  });

  it("aggiorna saldo e importa transazioni con categoria di fallback", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "150.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: { remaining: 3, resetSeconds: 3600 },
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-1",
          transactionAmount: { amount: "-20.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: { remaining: 3, resetSeconds: 3600 },
    });

    await syncAccountLink(link, createMemoryStore());

    const [account] = await db.select().from(accounts).where(eq(accounts.id, link.accountId));
    expect(account.balance).toBe("150.00");

    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(1);
    expect(storedTransactions[0].externalId).toBe("tx-1");
    expect(storedTransactions[0].amount).toBe("-20.00");
  });

  it("è idempotente: un secondo sync con la stessa transazione non duplica", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "150.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-1",
          transactionAmount: { amount: "-20.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());
    await syncAccountLink(link, createMemoryStore());

    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(1);
  });

  it("su 401 marca la connessione come 'expired'", async () => {
    vi.mocked(getAccountBalances).mockRejectedValue(new GoCardlessError("unauthorized", 401));

    await syncAccountLink(link, createMemoryStore());

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.id, link.connectionId));
    expect(connection.status).toBe("expired");
  });
});
