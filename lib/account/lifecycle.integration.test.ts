import { eq, inArray } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gocardless/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gocardless/client")>();
  return { ...actual, deleteRequisition: vi.fn() };
});

import { client, db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { authAccount, authSession, authUser } from "@/lib/db/schema/auth";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { budgets } from "@/lib/db/schema/budgets";
import { categories, DEFAULT_CATEGORIES } from "@/lib/db/schema/categories";
import { categorizationRules } from "@/lib/db/schema/categorization-rules";
import {
  instruments,
  investmentPlans,
  investmentPortfolios,
  investmentTransactions,
  userInstrumentPrices,
} from "@/lib/db/schema/investments";
import { debtEvents, debts } from "@/lib/db/schema/debts";
import { analyticsAssumptions } from "@/lib/db/schema/analytics";
import { pensionFunds, pensionSnapshots } from "@/lib/db/schema/pension";
import { netWorthSnapshots } from "@/lib/db/schema/net-worth-snapshots";
import { transactions } from "@/lib/db/schema/transactions";
import { defaultCategoryRows } from "@/lib/categories/seed";
import { deleteRequisition } from "@/lib/gocardless/client";
import { findDueLinks } from "@/lib/gocardless/scheduler";
import { findUsersWithAccounts } from "@/lib/net-worth/scheduler";
import { redis } from "@/lib/redis/client";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import { queuedAccount } from "@/lib/sync-jobs/types";
import { DEACTIVATION_GRACE_DAYS } from "./constants";
import { buildUserExportZip } from "./export";
import {
  cancelAccountDeletion,
  countUserData,
  deleteUserAccount,
  hasActiveSync,
  purgeDueAccountDeletions,
  resetUserAccount,
  scheduleAccountDeletion,
} from "./lifecycle";

const mockedDeleteRequisition = vi.mocked(deleteRequisition);
const DAY_MS = 24 * 60 * 60 * 1000;
const createdUserIds: string[] = [];
const createdInstrumentIds: string[] = [];

interface Fixture {
  userId: string;
  email: string;
  currentSessionId: string;
  otherSessionId: string;
  requisitionId: string;
  manualInstrumentId: string;
  commonInstrumentId: string;
  description: string;
}

/** Utente con un po' di tutto: conti, banca collegata, transazioni, budget, regole, investimenti, storico, sessioni. */
async function createUserWithData(): Promise<Fixture> {
  const tag = crypto.randomUUID();
  const userId = `test-account-${tag}`;
  const email = `test-account-${tag}@example.com`;
  const description = `SUPERMERCATO ${tag}`;
  await db.insert(authUser).values({ id: userId, name: "Test", email, onboardingCompleted: true, currency: "USD", homePage: "/conti" });
  createdUserIds.push(userId);

  const future = new Date(Date.now() + 7 * DAY_MS);
  const [current, other] = await db
    .insert(authSession)
    .values([
      { id: `s1-${tag}`, userId, token: `t1-${tag}`, expiresAt: future },
      { id: `s2-${tag}`, userId, token: `t2-${tag}`, expiresAt: future },
    ])
    .returning();
  await db.insert(authAccount).values({ id: `a-${tag}`, userId, accountId: `g-${tag}`, providerId: "google" });

  const cats = await db.insert(categories).values(defaultCategoryRows(userId)).returning();
  const category = cats.find((c) => !c.isFallback)!;
  const [manualAccount, autoAccount] = await db
    .insert(accounts)
    .values([
      { userId, name: "Contanti", type: "contanti", balance: "50.00" },
      { userId, name: "Banca", type: "corrente", balance: "1000.00", source: "auto" },
    ])
    .returning();
  const requisitionId = `req-${tag}`;
  const [connection] = await db
    .insert(bankConnections)
    .values({ userId, institutionId: "SANDBOX", institutionName: "Sandbox", requisitionId, status: "linked" })
    .returning();
  await db
    .insert(bankAccountLinks)
    .values({ connectionId: connection.id, accountId: autoAccount.id, externalAccountId: `ext-${tag}`, nextSyncEligibleAt: new Date(0) });
  await db.insert(transactions).values([
    { userId, accountId: manualAccount.id, categoryId: category.id, description, amount: "-12.50", date: "2026-09-01", note: "nota" },
    { userId, accountId: autoAccount.id, categoryId: category.id, description: "STIPENDIO", amount: "2000.00", date: "2026-09-02", source: "auto" },
  ]);
  await db.insert(budgets).values({ userId, categoryId: category.id, monthlyAmount: "300.00" });
  await db.insert(categorizationRules).values({ userId, matchType: "merchant", pattern: `supermercato ${tag}`, categoryId: category.id });

  const [manualInstrument, commonInstrument] = await db
    .insert(instruments)
    .values([
      { name: `Polizza privata ${tag}`, type: "fondo", currency: "EUR", priceMode: "manuale", createdByUserId: userId },
      { name: `ETF comune ${tag}`, type: "etf", currency: "EUR" },
    ])
    .returning();
  createdInstrumentIds.push(manualInstrument.id, commonInstrument.id);
  const [portfolio] = await db.insert(investmentPortfolios).values({ userId, name: "Principale" }).returning();
  await db.insert(investmentTransactions).values([
    { userId, portfolioId: portfolio.id, instrumentId: commonInstrument.id, type: "acquisto", date: "2026-08-01", quantity: "2", price: "100" },
    { userId, portfolioId: portfolio.id, instrumentId: manualInstrument.id, type: "acquisto", date: "2026-08-01", quantity: "1", price: "500" },
  ]);
  // Dato orfano di un PAC (funzione rimossa): la cancellazione dell'account deve comunque riuscire.
  await db.insert(investmentPlans).values({ userId, portfolioId: portfolio.id, instrumentId: commonInstrument.id, amount: "150", dayOfMonth: 5 });
  await db.insert(userInstrumentPrices).values({ userId, instrumentId: manualInstrument.id, date: "2026-09-01", close: "510" });
  await db.insert(netWorthSnapshots).values({ userId, date: "2026-09-01", assetClass: "liquidita", amount: "1050", source: "snapshot" });
  const [debt] = await db
    .insert(debts)
    .values({ userId, name: `Prestito ${tag}`, startMode: "nuovo", principal: "5000", annualRate: "5", installments: 24, firstInstallmentDate: "2026-10-05" })
    .returning();
  await db.insert(debtEvents).values({ debtId: debt.id, userId, type: "payment", date: "2026-10-05", amount: "219.36", installmentNumber: 1 });

  const [pensionFund] = await db.insert(pensionFunds).values({ userId, name: `Fondo ${tag}`, adhesionDate: "2022-03-15" }).returning();
  await db.insert(pensionSnapshots).values({ fundId: pensionFund.id, userId, date: "2026-09-30", netContributions: "1000", value: "1040" });
  await db.insert(analyticsAssumptions).values({ userId, data: { withdrawalRate: 0.03 } });

  await redis.set(`net-worth:investments:fingerprint:${userId}`, "x");
  await redisSyncJobStore.createJob({ userId, kind: "manual-sync", accounts: [queuedAccount(autoAccount.id, "Banca")] });

  return {
    userId,
    email,
    currentSessionId: current.id,
    otherSessionId: other.id,
    requisitionId,
    manualInstrumentId: manualInstrument.id,
    commonInstrumentId: commonInstrument.id,
    description,
  };
}

async function redisKeysFor(userId: string): Promise<string[]> {
  return [
    ...(await redis.keys(`sync-job:${userId}:*`)),
    ...(await redis.keys(`sync-jobs:${userId}`)),
    ...(await redis.keys(`net-worth:investments:fingerprint:${userId}`)),
  ];
}

describe("gestione account (integrazione)", () => {
  beforeEach(() => {
    mockedDeleteRequisition.mockReset().mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await db.delete(investmentTransactions).where(inArray(investmentTransactions.userId, createdUserIds));
    await db.delete(investmentPlans).where(inArray(investmentPlans.userId, createdUserIds));
    await db.delete(transactions).where(inArray(transactions.userId, createdUserIds));
    await db.delete(budgets).where(inArray(budgets.userId, createdUserIds));
    await db.delete(authUser).where(inArray(authUser.id, createdUserIds));
    await db.delete(instruments).where(inArray(instruments.id, createdInstrumentIds));
    for (const id of createdUserIds) {
      const keys = await redisKeysFor(id);
      if (keys.length) await redis.del(...keys);
    }
    await client.end();
    redis.disconnect();
  });

  it("conta i dati dell'utente", async () => {
    const f = await createUserWithData();
    expect(await countUserData(f.userId)).toEqual({
      accounts: 2,
      bankConnections: 1,
      transactions: 2,
      categories: DEFAULT_CATEGORIES.length,
      rules: 1,
      budgets: 1,
      investmentOperations: 2,
      debts: 1,
      pensionFunds: 1,
      netWorthDays: 1,
    });
  });

  it("l'export contiene JSON e CSV con i soli dati dell'utente, senza segreti", async () => {
    const f = await createUserWithData();
    const other = await createUserWithData();
    const files = unzipSync(await buildUserExportZip(f.userId, new Date("2026-09-29T10:00:00Z")));
    expect(Object.keys(files).sort()).toEqual(
      [
        "LEGGIMI.txt",
        "budget.csv",
        "categorie.csv",
        "conti.csv",
        "dati-completi.json",
        "debiti-eventi.csv",
        "debiti.csv",
        "investimenti-avvisi-prezzo.csv",
        "investimenti-operazioni.csv",
        "investimenti-titoli-seguiti.csv",
        "patrimonio-netto.csv",
        "previdenza-fondi.csv",
        "previdenza-fotografie.csv",
        "regole-categorizzazione.csv",
        "transazioni.csv",
      ].sort()
    );
    const json = strFromU8(files["dati-completi.json"]);
    const csv = strFromU8(files["transazioni.csv"]);
    expect(csv).toContain(f.description);
    expect(csv).toContain("-12,50");
    expect(json).toContain(f.email);
    expect(json).not.toContain(other.description);
    expect(json).not.toContain(other.email);
    expect(json).not.toContain(f.requisitionId);
    expect(json).not.toContain(`t1-`);
    const parsed = JSON.parse(json);
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.investmentOperations).toHaveLength(2);
    expect(parsed.debts).toHaveLength(1);
    expect(parsed.debts[0]).not.toHaveProperty("userId");
    expect(parsed.debtEvents).toHaveLength(1);
    expect(parsed.pensionFunds).toHaveLength(1);
    expect(parsed.pensionSnapshots).toHaveLength(1);
    expect(parsed.analyticsAssumptions.data).toEqual({ withdrawalRate: 0.03 });
  });

  it("il reset cancella tutto, ricrea le categorie, riporta all'onboarding e revoca la banca", async () => {
    const f = await createUserWithData();
    const other = await createUserWithData();
    await resetUserAccount(f.userId);

    expect(await countUserData(f.userId)).toEqual({
      accounts: 0,
      bankConnections: 0,
      transactions: 0,
      categories: DEFAULT_CATEGORIES.length,
      rules: 0,
      budgets: 0,
      investmentOperations: 0,
      debts: 0,
      pensionFunds: 0,
      netWorthDays: 0,
    });
    expect(await db.select().from(analyticsAssumptions).where(eq(analyticsAssumptions.userId, f.userId))).toHaveLength(0);
    const [user] = await db.select().from(authUser).where(eq(authUser.id, f.userId));
    expect(user).toMatchObject({ onboardingCompleted: false, currency: "EUR", homePage: "/panoramica", deletionScheduledAt: null });
    expect(await db.select().from(authSession).where(eq(authSession.userId, f.userId))).toHaveLength(2);
    expect(mockedDeleteRequisition).toHaveBeenCalledWith(f.requisitionId);
    expect(await redisKeysFor(f.userId)).toEqual([]);
    // Lo strumento manuale privato sparisce, quello comune resta.
    expect(await db.select().from(instruments).where(eq(instruments.id, f.manualInstrumentId))).toHaveLength(0);
    expect(await db.select().from(instruments).where(eq(instruments.id, f.commonInstrumentId))).toHaveLength(1);
    // L'altro utente non viene toccato.
    expect((await countUserData(other.userId)).transactions).toBe(2);
    expect(await redisKeysFor(other.userId)).not.toEqual([]);
  });

  it("l'eliminazione cancella utente, sessioni e dati anche se la revoca della banca fallisce", async () => {
    const f = await createUserWithData();
    const other = await createUserWithData();
    mockedDeleteRequisition.mockRejectedValue(new Error("GoCardless giù"));
    await deleteUserAccount(f.userId);

    expect(await db.select().from(authUser).where(eq(authUser.id, f.userId))).toHaveLength(0);
    expect(await db.select().from(authSession).where(eq(authSession.userId, f.userId))).toHaveLength(0);
    expect(await db.select().from(authAccount).where(eq(authAccount.userId, f.userId))).toHaveLength(0);
    expect(Object.values(await countUserData(f.userId)).every((n) => n === 0)).toBe(true);
    expect(await db.select().from(instruments).where(eq(instruments.id, f.manualInstrumentId))).toHaveLength(0);
    expect(await redisKeysFor(f.userId)).toEqual([]);
    expect((await countUserData(other.userId)).accounts).toBe(2);
  });

  it("la disattivazione programma l'eliminazione, chiude le altre sessioni e ferma i cron", async () => {
    const f = await createUserWithData();
    const now = new Date();
    expect((await findDueLinks()).some((l) => l.userId === f.userId)).toBe(true);
    expect(await findUsersWithAccounts()).toContain(f.userId);

    const deletionAt = await scheduleAccountDeletion(f.userId, f.currentSessionId, now);
    expect(deletionAt.getTime() - now.getTime()).toBe(DEACTIVATION_GRACE_DAYS * DAY_MS);
    const sessions = await db.select({ id: authSession.id }).from(authSession).where(eq(authSession.userId, f.userId));
    expect(sessions.map((s) => s.id)).toEqual([f.currentSessionId]);
    expect((await findDueLinks()).some((l) => l.userId === f.userId)).toBe(false);
    expect(await findUsersWithAccounts()).not.toContain(f.userId);

    await cancelAccountDeletion(f.userId);
    const [user] = await db.select().from(authUser).where(eq(authUser.id, f.userId));
    expect(user.deletionScheduledAt).toBeNull();
    expect((await findDueLinks()).some((l) => l.userId === f.userId)).toBe(true);
    // Dati intatti dopo disattivazione + riattivazione.
    expect((await countUserData(f.userId)).transactions).toBe(2);
  });

  it("il cron elimina solo gli account con data di eliminazione passata", async () => {
    const due = await createUserWithData();
    const notYet = await createUserWithData();
    const now = new Date();
    await db.update(authUser).set({ deletionScheduledAt: new Date(now.getTime() - 1000) }).where(eq(authUser.id, due.userId));
    await db.update(authUser).set({ deletionScheduledAt: new Date(now.getTime() + DAY_MS) }).where(eq(authUser.id, notYet.userId));

    const result = await purgeDueAccountDeletions(now);
    expect(result.failed).toBe(0);
    expect(result.deleted).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(authUser).where(eq(authUser.id, due.userId))).toHaveLength(0);
    expect(await db.select().from(authUser).where(eq(authUser.id, notYet.userId))).toHaveLength(1);
  });

  it("hasActiveSync vede un sync in corso e ignora quelli finiti", async () => {
    const f = await createUserWithData();
    expect(await hasActiveSync(f.userId)).toBe(true);
    const [job] = await redisSyncJobStore.listJobs(f.userId);
    await redisSyncJobStore.updateAccount(f.userId, job.id, job.accounts[0].accountId, { phase: "done" });
    expect(await hasActiveSync(f.userId)).toBe(false);
  });
});
