import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { client, db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { categories } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import { transactions } from "@/lib/db/schema/transactions";
import { MIN_SYNC_GAP_MS } from "./sync-eligibility";
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

  it("aggiorna saldo, importa transazioni e conta il risultato come non categorizzato (fallback)", async () => {
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

    const result = await syncAccountLink(link, createMemoryStore());
    expect(result).toEqual({
      status: "synced",
      newTransactionsCount: 1,
      categorizedCount: 0,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });

    const [account] = await db.select().from(accounts).where(eq(accounts.id, link.accountId));
    expect(account.balance).toBe("150.00");

    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(1);
    expect(storedTransactions[0].externalId).toBe("tx-1");
    expect(storedTransactions[0].amount).toBe("-20.00");
  });

  it("usa creditorName come description su una spesa (importo negativo), salvando il testo grezzo in rawDescription", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-creditor",
          transactionAmount: { amount: "-20.00", currency: "EUR" },
          remittanceInformationUnstructured: "PAGAMENTO POS ESSELUNGA VIA ROMA COD.4471",
          creditorName: "ESSELUNGA SPA",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("ESSELUNGA SPA");
    expect(stored.rawDescription).toBe("PAGAMENTO POS ESSELUNGA VIA ROMA COD.4471");
  });

  it("usa debtorName come description su un'entrata (importo positivo)", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-debtor",
          transactionAmount: { amount: "500.00", currency: "EUR" },
          remittanceInformationUnstructured: "BONIFICO RIF.998877",
          debtorName: "MARIO ROSSI SRL",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("MARIO ROSSI SRL");
    expect(stored.rawDescription).toBe("BONIFICO RIF.998877");
  });

  it("senza creditorName/debtorName ricade sulla descrizione grezza, con rawDescription uguale a description", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-no-merchant",
          transactionAmount: { amount: "-8.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("Supermercato");
    expect(stored.rawDescription).toBe("Supermercato");
  });

  it("senza nessun campo testuale ricade su 'Movimento bancario', con rawDescription null", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-empty",
          transactionAmount: { amount: "-3.00", currency: "EUR" },
          bookingDate: "2026-07-01",
        },
      ],
      rateLimit: null,
    });

    await syncAccountLink(link, createMemoryStore());

    const [stored] = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(stored.description).toBe("Movimento bancario");
    expect(stored.rawDescription).toBeNull();
  });

  it("distingue le transazioni categorizzate da una regola da quelle finite nel fallback", async () => {
    const [category] = await db.insert(categories).values({ userId, name: "Spesa", type: "variabile" }).returning();
    await db.insert(categorizationRules).values({
      userId,
      matchType: "merchant",
      pattern: "supermercato",
      categoryId: category.id,
    });

    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "100.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({
      transactions: [
        {
          internalTransactionId: "tx-cat",
          transactionAmount: { amount: "-15.00", currency: "EUR" },
          remittanceInformationUnstructured: "Supermercato",
          bookingDate: "2026-07-02",
        },
        {
          internalTransactionId: "tx-fallback",
          transactionAmount: { amount: "-5.00", currency: "EUR" },
          remittanceInformationUnstructured: "Sconosciuto",
          bookingDate: "2026-07-02",
        },
      ],
      rateLimit: null,
    });

    const result = await syncAccountLink(link, createMemoryStore());
    expect(result).toEqual({
      status: "synced",
      newTransactionsCount: 2,
      categorizedCount: 1,
      uncategorizedCount: 1,
      balanceUpdated: true,
    });
  });

  it("è idempotente: un secondo sync con la stessa transazione non la riconta come nuova", async () => {
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
    const secondResult = await syncAccountLink(link, createMemoryStore());

    expect(secondResult).toEqual({
      status: "synced",
      newTransactionsCount: 0,
      categorizedCount: 0,
      uncategorizedCount: 0,
      balanceUpdated: true,
    });
    const storedTransactions = await db.select().from(transactions).where(eq(transactions.accountId, link.accountId));
    expect(storedTransactions).toHaveLength(1);
  });

  it("su 401 marca la connessione come 'expired' e ritorna status 'expired'", async () => {
    vi.mocked(getAccountBalances).mockRejectedValue(new GoCardlessError("unauthorized", 401));

    const result = await syncAccountLink(link, createMemoryStore());
    expect(result).toEqual({ status: "expired" });

    const [connection] = await db.select().from(bankConnections).where(eq(bankConnections.id, link.connectionId));
    expect(connection.status).toBe("expired");
  });

  it("aggiorna lastSyncedAt/syncTimestamps/nextSyncEligibleAt dopo un sync riuscito", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "50.00", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({ transactions: [], rateLimit: null });

    const before = Date.now();
    await syncAccountLink(link, createMemoryStore());

    const [updatedLink] = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.id, link.linkId));
    expect(updatedLink.lastSyncedAt).not.toBeNull();
    expect(updatedLink.syncTimestamps).toHaveLength(1);
    expect(new Date(updatedLink.syncTimestamps[0]).getTime()).toBeGreaterThanOrEqual(before);
    expect(updatedLink.nextSyncEligibleAt.getTime()).toBeGreaterThanOrEqual(before + MIN_SYNC_GAP_MS);
  });

  it("mantiene solo gli ultimi 4 timestamp di sync", async () => {
    await db
      .update(bankAccountLinks)
      .set({
        syncTimestamps: [4, 8, 12, 16].map((h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString()),
      })
      .where(eq(bankAccountLinks.id, link.linkId));

    vi.mocked(getAccountBalances).mockResolvedValue({
      balance: { balanceAmount: { amount: "0", currency: "EUR" }, balanceType: "interimAvailable" },
      rateLimit: null,
    });
    vi.mocked(getAccountTransactions).mockResolvedValue({ transactions: [], rateLimit: null });

    await syncAccountLink(link, createMemoryStore());

    const [updatedLink] = await db.select().from(bankAccountLinks).where(eq(bankAccountLinks.id, link.linkId));
    expect(updatedLink.syncTimestamps).toHaveLength(4);
  });
});
