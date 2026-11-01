import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { authUser } from "@/lib/db/schema/auth";
import { accounts } from "@/lib/db/schema/accounts";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { instruments, investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import { personalFormats, personalImportJobs } from "@/lib/db/schema/personal-imports";
import { AccountDeletionError, deleteAccountWithData, previewAccountDeletion } from "./account-deletion.server";

let userId: string;
let categoryId: string;
let instrumentId: string;
const users: string[] = [];

beforeEach(async () => {
  userId = `account-deletion-${randomUUID()}`;
  users.push(userId);
  await db.insert(authUser).values({ id: userId, name: "Test", email: `${userId}@example.test`, emailVerified: false, currency: "EUR" });
  [{ id: categoryId }] = await db.insert(categories).values({ userId, name: "Varie", type: "voluta" }).returning();
  [{ id: instrumentId }] = await db.insert(instruments).values({ createdByUserId: userId, name: "Synthetic share", type: "azione", currency: "EUR", priceMode: "manuale" }).returning();
});

afterAll(async () => {
  for (const id of users) {
    await db.delete(investmentTransactions).where(eq(investmentTransactions.userId, id));
    await db.delete(transactions).where(eq(transactions.userId, id));
    await db.delete(instruments).where(eq(instruments.createdByUserId, id));
    await db.delete(authUser).where(eq(authUser.id, id));
  }
});

const trade = (portfolioId: string, extra: Partial<typeof investmentTransactions.$inferInsert> = {}) => ({ userId, portfolioId, instrumentId, type: "acquisto" as const, date: "2024-01-02", quantity: "1", price: "10", fxRate: "1", fees: "0", taxes: "0", ...extra });
const cash = (accountId: string) => ({ userId, accountId, categoryId, description: "Movimento", amount: "-5.00", date: "2024-01-03", source: "manuale" as const });
const job = (formatId: string, extra: Partial<typeof personalImportJobs.$inferInsert> = {}) => ({ userId, formatId, status: "imported", estimatedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), ...extra });

/** A broker account as a statement import leaves it: cash account, own portfolio, source, statement, operations and the uploaded file. */
async function brokerAccount(key = "U1") {
  const [account] = await db.insert(accounts).values({ userId, name: `Interactive Brokers · liquidità ${key}`, type: "Liquidità broker", balance: "-10.00", source: "manuale" }).returning();
  const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: `Interactive Brokers ${key}`, broker: `ibkr:${key}`, statementCashAccountId: account.id }).returning();
  await db.insert(brokerImportAccounts).values({ userId, accountKey: key, provider: "interactive-brokers", portfolioId: portfolio.id, cashAccountId: account.id });
  await db.insert(brokerStatements).values({ userId, portfolioId: portfolio.id, cashAccountId: account.id, accountKey: key, fingerprint: randomUUID(), from: "2024-01-01", to: "2024-12-31", statement: { provider: "interactive-brokers" } as never, records: [] });
  await db.insert(investmentTransactions).values([trade(portfolio.id, { statementAccountKey: key }), trade(portfolio.id, { statementAccountKey: key, date: "2024-02-01" })]);
  await db.insert(transactions).values(cash(account.id));
  const [format] = await db.insert(personalFormats).values({ userId, name: "Interactive Brokers" }).returning();
  const [upload] = await db.insert(personalImportJobs).values(job(format.id, { brokerProvider: "interactive-brokers", importLedger: { cashIds: [], tradeIds: [], receiptKeys: [], native: { provider: "interactive-brokers", name: "Interactive Brokers", inserted: 2 } } })).returning();
  return { account, portfolio, upload };
}

describe("deleteAccountWithData", () => {
  it("a broker's cash account takes its portfolio, operations, statements and uploaded files; hand-entered operations stay", async () => {
    const { account, portfolio, upload } = await brokerAccount();
    const [manual] = await db.insert(investmentPortfolios).values({ userId, name: "Portafoglio" }).returning();
    await db.insert(investmentTransactions).values(trade(manual.id));

    const preview = await previewAccountDeletion(userId, account.id);
    expect(preview).toMatchObject({ cashCount: 1, investmentCount: 2, portfolios: ["Interactive Brokers U1"], imports: 2 });
    await deleteAccountWithData(userId, account.id, preview.token);

    expect(await db.select().from(accounts).where(eq(accounts.id, account.id))).toHaveLength(0);
    expect(await db.select().from(investmentPortfolios).where(eq(investmentPortfolios.id, portfolio.id))).toHaveLength(0);
    expect(await db.select().from(brokerStatements).where(eq(brokerStatements.userId, userId))).toHaveLength(0);
    expect(await db.select().from(brokerImportAccounts).where(eq(brokerImportAccounts.userId, userId))).toHaveLength(0);
    expect(await db.select().from(personalImportJobs).where(eq(personalImportJobs.id, upload.id))).toHaveLength(0);
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(1);
  });

  it("a file's account takes its format, uploads, operations and the portfolio created for it", async () => {
    const [account] = await db.insert(accounts).values({ userId, name: "IB · CSV", type: "conto", balance: "0", source: "manuale" }).returning();
    const [format] = await db.insert(personalFormats).values({ userId, name: "IB", accountId: account.id }).returning();
    const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "IB · CSV", broker: `personal:${format.id}` }).returning();
    await db.update(personalFormats).set({ portfolioId: portfolio.id }).where(eq(personalFormats.id, format.id));
    const [row] = await db.insert(investmentTransactions).values(trade(portfolio.id)).returning();
    const [movement] = await db.insert(transactions).values(cash(account.id)).returning();
    await db.insert(personalImportJobs).values(job(format.id, { importLedger: { cashIds: [movement.id], tradeIds: [row.id], receiptKeys: [] } }));

    const preview = await previewAccountDeletion(userId, account.id);
    expect(preview).toMatchObject({ cashCount: 1, investmentCount: 1, portfolios: ["IB · CSV"], imports: 1 });
    await deleteAccountWithData(userId, account.id, preview.token);

    expect(await db.select().from(personalFormats).where(eq(personalFormats.userId, userId))).toHaveLength(0);
    expect(await db.select().from(personalImportJobs).where(eq(personalImportJobs.userId, userId))).toHaveLength(0);
    expect(await db.select().from(investmentPortfolios).where(eq(investmentPortfolios.userId, userId))).toHaveLength(0);
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.userId, userId))).toHaveLength(0);
  });

  it("in a portfolio shared with hand-entered operations only this broker's operations go, and the portfolio stays", async () => {
    const [account] = await db.insert(accounts).values({ userId, name: "DEGIRO · liquidità", type: "Liquidità broker", balance: "0", source: "manuale" }).returning();
    const [shared] = await db.insert(investmentPortfolios).values({ userId, name: "Portafoglio" }).returning();
    await db.insert(brokerImportAccounts).values({ userId, accountKey: "degiro:1", provider: "degiro", portfolioId: shared.id, cashAccountId: account.id });
    await db.insert(investmentTransactions).values([trade(shared.id, { statementAccountKey: "degiro:1" }), trade(shared.id)]);

    const preview = await previewAccountDeletion(userId, account.id);
    expect(preview).toMatchObject({ investmentCount: 1, portfolios: [] });
    await deleteAccountWithData(userId, account.id, preview.token);

    expect(await db.select().from(investmentPortfolios).where(eq(investmentPortfolios.id, shared.id))).toHaveLength(1);
    const left = await db.select().from(investmentTransactions).where(eq(investmentTransactions.portfolioId, shared.id));
    expect(left.map((t) => t.statementAccountKey)).toEqual([null]);
  });

  it("refuses without the reviewed token, and when a hand-entered sale needs the shares this broker bought", async () => {
    const { account } = await brokerAccount("U2");
    await expect(deleteAccountWithData(userId, account.id, undefined)).rejects.toBeInstanceOf(AccountDeletionError);
    expect(await db.select().from(accounts).where(eq(accounts.id, account.id))).toHaveLength(1);

    const [other] = await db.insert(accounts).values({ userId, name: "DEGIRO · liquidità", type: "Liquidità broker", balance: "0", source: "manuale" }).returning();
    const [shared] = await db.insert(investmentPortfolios).values({ userId, name: "Portafoglio" }).returning();
    await db.insert(brokerImportAccounts).values({ userId, accountKey: "degiro:2", provider: "degiro", portfolioId: shared.id, cashAccountId: other.id });
    await db.insert(investmentTransactions).values([trade(shared.id, { statementAccountKey: "degiro:2" }), trade(shared.id, { type: "vendita", date: "2024-03-01" })]);
    const preview = await previewAccountDeletion(userId, other.id);
    await expect(deleteAccountWithData(userId, other.id, preview.token)).rejects.toThrow("vendono quote");
    expect(await db.select().from(investmentTransactions).where(eq(investmentTransactions.portfolioId, shared.id))).toHaveLength(2);
  });

  it("a plain account goes without a token, as before", async () => {
    const [account] = await db.insert(accounts).values({ userId, name: "Contanti", type: "Contanti", balance: "10.00", source: "manuale" }).returning();
    await db.insert(transactions).values(cash(account.id));
    await expect(deleteAccountWithData(userId, account.id, undefined)).resolves.toMatchObject({ cashCount: 1, investmentCount: 0, portfolios: [], imports: 0 });
    expect(await db.select().from(accounts).where(eq(accounts.id, account.id))).toHaveLength(0);
  });
});
