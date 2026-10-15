import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { transactions } from "@/lib/db/schema/transactions";
import { getFallbackCategoryId } from "@/lib/categorization/fallback";
import type { RateLimitStore } from "./rate-limit";

vi.mock("@/lib/bank-data/enablebanking/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bank-data/enablebanking/client")>();
  return { ...actual, getAccountBalances: vi.fn(), getAccountTransactions: vi.fn() };
});

import { EnableBankingError, getAccountBalances, getAccountTransactions, type EnableBankingTransaction } from "./enablebanking/client";
import { syncAccountLink, type SyncableLink } from "./sync";

function createMemoryStore(): RateLimitStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

function ebTransaction(overrides: Partial<EnableBankingTransaction>): EnableBankingTransaction {
  return {
    transaction_amount: { amount: "1.20", currency: "EUR" },
    credit_debit_indicator: "DBIT",
    status: "BOOK",
    booking_date: "2026-10-01",
    remittance_information: ["Bar Centrale"],
    ...overrides,
  };
}

describe("syncAccountLink con Enable Banking", () => {
  let userId: string;
  let link: SyncableLink;
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    vi.mocked(getAccountBalances).mockReset();
    vi.mocked(getAccountTransactions).mockReset();
    const [user] = await db
      .insert(authUser)
      .values({ id: `test-eb-${crypto.randomUUID()}`, name: "Test EB", email: `test-eb-${crypto.randomUUID()}@example.com`, emailVerified: false, currency: "EUR" })
      .returning();
    userId = user.id;
    createdUserIds.push(userId);
    const [account] = await db
      .insert(accounts)
      .values({ userId, name: "Conto", type: "Conto corrente", balance: "0", source: "auto" })
      .returning();
    const [connection] = await db
      .insert(bankConnections)
      .values({ userId, provider: "enablebanking", institutionId: "IT:Banca Test", institutionName: "Banca Test", status: "linked", requisitionId: "session-1" })
      .returning();
    const [linkRow] = await db
      .insert(bankAccountLinks)
      .values({ connectionId: connection.id, accountId: account.id, externalAccountId: "uid-1" })
      .returning();
    link = { linkId: linkRow.id, connectionId: connection.id, provider: "enablebanking", accountId: account.id, externalAccountId: "uid-1", userId };
    vi.mocked(getAccountBalances).mockResolvedValue([
      { balance_type: "CLBD", balance_amount: { amount: "90.00", currency: "EUR" } },
      { balance_type: "ITAV", balance_amount: { amount: "100.00", currency: "EUR" } },
    ]);
  });

  afterEach(async () => {
    await db.delete(authUser).where(inArray(authUser.id, createdUserIds));
    createdUserIds.length = 0;
  });

  afterAll(async () => {
    await client.end();
  });

  it("salva saldo disponibile e movimenti con segno e id prefissato, chiedendo tutto lo storico al primo import", async () => {
    vi.mocked(getAccountTransactions).mockResolvedValue([
      ebTransaction({ entry_reference: "ref-1", creditor: { name: "Bar Centrale" } }),
      ebTransaction({ entry_reference: "ref-2", credit_debit_indicator: "CRDT", transaction_amount: { amount: "1500.00", currency: "EUR" }, debtor: { name: "Datore" } }),
      ebTransaction({ entry_reference: "ref-3", status: "PDNG" }),
    ]);

    const result = await syncAccountLink(link, createMemoryStore());

    expect(result).toMatchObject({ status: "synced", newTransactionsCount: 2 });
    expect(vi.mocked(getAccountTransactions)).toHaveBeenCalledWith("uid-1", null);
    const [account] = await db.select().from(accounts).where(eq(accounts.id, link.accountId));
    expect(account.balance).toBe("100.00");
    const rows = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(rows.map((row) => [row.externalId, row.amount]).sort()).toEqual([
      ["eb:ref-1", "-1.20"],
      ["eb:ref-2", "1500.00"],
    ]);
  });

  it("dopo il primo sync chiede solo gli ultimi giorni (con un margine)", async () => {
    await db.update(bankAccountLinks).set({ lastSyncedAt: new Date("2026-10-10T08:00:00Z") }).where(eq(bankAccountLinks.id, link.linkId));
    vi.mocked(getAccountTransactions).mockResolvedValue([]);

    await syncAccountLink(link, createMemoryStore());

    expect(vi.mocked(getAccountTransactions)).toHaveBeenCalledWith("uid-1", "2026-09-10");
  });

  it("non duplica i movimenti già arrivati da GoCardless, contando i doppi dello stesso giorno", async () => {
    // Due caffè da GoCardless (id senza prefisso), tre da Enable Banking: se ne aggiunge uno solo.
    const categoryId = await getFallbackCategoryId(userId);
    await db.insert(transactions).values(
      ["gc-a", "gc-b"].map((externalId) => ({
        userId,
        accountId: link.accountId,
        categoryId,
        description: "Bar Centrale",
        amount: "-1.20",
        date: "2026-10-01",
        source: "auto" as const,
        externalId,
      }))
    );
    const three = [
      ebTransaction({ entry_reference: "x-1" }),
      ebTransaction({ entry_reference: "x-2" }),
      ebTransaction({ entry_reference: "x-3" }),
    ];
    vi.mocked(getAccountTransactions).mockResolvedValue(three);

    const first = await syncAccountLink(link, createMemoryStore());
    expect(first).toMatchObject({ status: "synced", newTransactionsCount: 1 });

    // Rilette in ordine diverso, le stesse tre non aggiungono nulla.
    vi.mocked(getAccountTransactions).mockResolvedValue([...three].reverse());
    const second = await syncAccountLink(link, createMemoryStore());
    expect(second).toMatchObject({ status: "synced", newTransactionsCount: 0 });

    const rows = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(rows).toHaveLength(3);
  });

  it("segna la connessione scaduta quando la sessione non è più valida", async () => {
    vi.mocked(getAccountBalances).mockRejectedValue(new EnableBankingError("accounts.balances", 401, "EXPIRED_SESSION"));

    const result = await syncAccountLink(link, createMemoryStore());

    expect(result).toEqual({ status: "expired" });
    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.id, link.connectionId));
    expect(connection.status).toBe("expired");
  });

  it("si ferma qualche ora quando la banca risponde «troppe richieste»", async () => {
    vi.mocked(getAccountTransactions).mockRejectedValue(new EnableBankingError("accounts.transactions", 429, "ASPSP_RATE_LIMIT_EXCEEDED"));
    const store = createMemoryStore();

    expect(await syncAccountLink(link, store)).toEqual({ status: "bank-limited" });
    expect(await syncAccountLink(link, store)).toEqual({ status: "bank-limited" });
    expect(vi.mocked(getAccountTransactions)).toHaveBeenCalledTimes(1);
  });
});
