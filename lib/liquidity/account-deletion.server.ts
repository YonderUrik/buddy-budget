import "server-only";
import { and, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { brokerImportAccounts } from "@/lib/db/schema/broker-import-accounts";
import { brokerStatements } from "@/lib/db/schema/broker-statements";
import { investmentPortfolios, investmentTransactions } from "@/lib/db/schema/investments";
import { personalFormats, personalImportJobs } from "@/lib/db/schema/personal-imports";
import { transactions } from "@/lib/db/schema/transactions";
import { findOversoldTransaction } from "@/lib/calc/investments";
import { statementSourceScope } from "@/lib/investments/import/source-scope";
import { digest } from "@/lib/personal-import/crypto";
import { clearExclusions } from "@/lib/investments/import/exclusions.server";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What deleting an account takes with it, as the confirmation shows it. */
export interface AccountDeletionSummary {
  token: string;
  name: string;
  cashCount: number;
  investmentCount: number;
  /** Portfolios removed whole (each one belonged only to this account). */
  portfolios: string[];
  /** Broker statements and uploaded files removed with the account. */
  imports: number;
}

export class AccountDeletionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Everything an account brought in: its cash movements, the broker sources and statements that use it as their cash
 * account, the personal file formats that write to it and their uploads, and the portfolios fed only by those. A portfolio
 * shared with something else (the one of hand-entered operations, another broker account) keeps its other operations:
 * only this account's ones go.
 */
async function deletionPlan(tx: Tx, userId: string, accountId: string) {
  // The same locks as the imports and their deletions: nothing is imported into this account while it is being removed.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 91473)`);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}), 81234)`);
  const [account] = await tx.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))).for("update");
  if (!account) throw new AccountDeletionError("Conto non trovato", 404);

  const cash = await tx.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.accountId, accountId))).orderBy(transactions.id);
  const sources = await tx.select().from(brokerImportAccounts).where(and(eq(brokerImportAccounts.userId, userId), eq(brokerImportAccounts.cashAccountId, accountId))).orderBy(brokerImportAccounts.id);
  const statementRows = await tx.select({ id: brokerStatements.id, accountKey: brokerStatements.accountKey, portfolioId: brokerStatements.portfolioId, provider: sql<string | null>`${brokerStatements.statement}->>'provider'` }).from(brokerStatements).where(and(eq(brokerStatements.userId, userId), eq(brokerStatements.cashAccountId, accountId))).orderBy(brokerStatements.id);
  const keys = [...new Set([...sources.map(s => s.accountKey), ...statementRows.map(s => s.accountKey)])];
  // Every statement of those broker accounts goes, also one saved before the cash account was linked.
  const statements = keys.length ? await tx.select({ id: brokerStatements.id, accountKey: brokerStatements.accountKey, portfolioId: brokerStatements.portfolioId }).from(brokerStatements).where(and(eq(brokerStatements.userId, userId), inArray(brokerStatements.accountKey, keys))).orderBy(brokerStatements.id) : [];
  const formats = await tx.select().from(personalFormats).where(and(eq(personalFormats.userId, userId), eq(personalFormats.accountId, accountId))).orderBy(personalFormats.id);
  const formatIds = formats.map(f => f.id);
  const jobs = formatIds.length ? await tx.select({ id: personalImportJobs.id, ledger: personalImportJobs.importLedger }).from(personalImportJobs).where(and(eq(personalImportJobs.userId, userId), inArray(personalImportJobs.formatId, formatIds))).orderBy(personalImportJobs.id) : [];

  const linked = await tx.select().from(investmentPortfolios).where(and(eq(investmentPortfolios.userId, userId), eq(investmentPortfolios.statementCashAccountId, accountId)));
  const portfolioIds = [...new Set([...sources.map(s => s.portfolioId), ...statements.map(s => s.portfolioId), ...linked.map(p => p.id), ...formats.flatMap(f => f.portfolioId ? [f.portfolioId] : [])])];
  const portfolios = portfolioIds.length ? await tx.select().from(investmentPortfolios).where(and(eq(investmentPortfolios.userId, userId), inArray(investmentPortfolios.id, portfolioIds))).orderBy(investmentPortfolios.id) : [];

  // A portfolio goes whole only when nothing outside this account feeds it; the one without a broker (hand-entered
  // operations) never goes whole.
  const whole: typeof portfolios = [];
  const partial: typeof portfolios = [];
  for (const portfolio of portfolios) {
    const [otherSource] = await tx.select({ id: brokerImportAccounts.id }).from(brokerImportAccounts).where(and(eq(brokerImportAccounts.portfolioId, portfolio.id), keys.length ? notInArray(brokerImportAccounts.accountKey, keys) : sql`true`)).limit(1);
    const [otherStatement] = await tx.select({ id: brokerStatements.id }).from(brokerStatements).where(and(eq(brokerStatements.portfolioId, portfolio.id), keys.length ? notInArray(brokerStatements.accountKey, keys) : sql`true`)).limit(1);
    const [otherFormat] = await tx.select({ id: personalFormats.id }).from(personalFormats).where(and(eq(personalFormats.portfolioId, portfolio.id), formatIds.length ? notInArray(personalFormats.id, formatIds) : sql`true`)).limit(1);
    (portfolio.broker && !otherSource && !otherStatement && !otherFormat ? whole : partial).push(portfolio);
  }

  // Operations: all of a whole portfolio; in a shared one, those of this account's broker sources and uploaded files.
  const ledgerTrades = jobs.flatMap(j => j.ledger?.tradeIds ?? []);
  const scopes = partial.flatMap(p => [
    ...keys.map(key => and(eq(investmentTransactions.portfolioId, p.id), statementSourceScope(key, p.broker))!),
    ...(ledgerTrades.length ? [and(eq(investmentTransactions.portfolioId, p.id), inArray(investmentTransactions.id, ledgerTrades))!] : []),
  ]);
  const wholeIds = whole.map(p => p.id);
  const trades = wholeIds.length || scopes.length
    ? await tx.select({ id: investmentTransactions.id, portfolioId: investmentTransactions.portfolioId }).from(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), or(...(wholeIds.length ? [inArray(investmentTransactions.portfolioId, wholeIds)] : []), ...scopes))).orderBy(investmentTransactions.id)
    : [];

  // Files read by a built-in reader carry no account: they go when no other account of the same broker is left.
  const providers = [...new Set([...sources.map(s => s.provider), ...statementRows.flatMap(s => s.provider ? [s.provider] : [])])];
  const nativeJobs: { id: string }[] = [];
  for (const provider of providers) {
    const [other] = await tx.select({ id: brokerImportAccounts.id }).from(brokerImportAccounts).where(and(eq(brokerImportAccounts.userId, userId), eq(brokerImportAccounts.provider, provider), keys.length ? notInArray(brokerImportAccounts.accountKey, keys) : sql`true`)).limit(1);
    if (other) continue;
    nativeJobs.push(...await tx.select({ id: personalImportJobs.id }).from(personalImportJobs).where(and(eq(personalImportJobs.userId, userId), eq(personalImportJobs.status, "imported"), eq(personalImportJobs.brokerProvider, provider), sql`${personalImportJobs.importLedger} ? 'native'`)).orderBy(personalImportJobs.id));
  }

  const token = digest(JSON.stringify({ account: [account.id, account.updatedAt], cash, keys, statements, formatIds, jobs: jobs.map(j => j.id), nativeJobs, whole: wholeIds, partial: partial.map(p => p.id), trades }));
  return { account, cash, keys, statements, formats, jobs, nativeJobs, whole, partial, trades, token };
}

type Plan = Awaited<ReturnType<typeof deletionPlan>>;

function summary(plan: Plan): AccountDeletionSummary {
  const uploads = new Set([...plan.jobs.map(j => j.id), ...plan.nativeJobs.map(j => j.id)]);
  return { token: plan.token, name: plan.account.name, cashCount: plan.cash.length, investmentCount: plan.trades.length, portfolios: plan.whole.map(p => p.name), imports: plan.statements.length + uploads.size };
}

/** True when deleting the account removes more than the account and its cash movements, so a reviewed token is required. */
function touchesInvestments(plan: Plan): boolean {
  return plan.trades.length > 0 || plan.statements.length > 0 || plan.formats.length > 0 || plan.nativeJobs.length > 0 || plan.whole.length > 0 || plan.keys.length > 0;
}

/** What deleting the account would remove, with the token the deletion must send back. */
export async function previewAccountDeletion(userId: string, accountId: string): Promise<AccountDeletionSummary> {
  return db.transaction(async tx => summary(await deletionPlan(tx, userId, accountId)), { isolationLevel: "repeatable read" });
}

/**
 * Deletes the account with its cash movements and, for an account an import created, the portfolio, operations,
 * statements and uploaded files that came with it. An account linked to investments needs the token of the reviewed
 * preview: if anything changed in between nothing is deleted.
 */
export async function deleteAccountWithData(userId: string, accountId: string, token: string | undefined): Promise<AccountDeletionSummary> {
  return db.transaction(async tx => {
    const plan = await deletionPlan(tx, userId, accountId);
    if (touchesInvestments(plan) && token !== plan.token) throw new AccountDeletionError("I dati del conto sono cambiati: riapri la conferma e controlla di nuovo cosa viene eliminato.", 409);

    const removed = new Set(plan.trades.map(t => t.id));
    const partialIds = plan.partial.map(p => p.id);
    if (partialIds.length) {
      const remaining = (await tx.select().from(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), inArray(investmentTransactions.portfolioId, partialIds))).for("update")).filter(t => !removed.has(t.id));
      if (partialIds.some(id => findOversoldTransaction(remaining.filter(t => t.portfolioId === id)))) throw new AccountDeletionError("Altre operazioni vendono quote comprate con questo conto: elimina prima quelle vendite.", 409);
    }

    if (removed.size) await tx.delete(investmentTransactions).where(and(eq(investmentTransactions.userId, userId), inArray(investmentTransactions.id, [...removed])));
    if (plan.statements.length) await tx.delete(brokerStatements).where(and(eq(brokerStatements.userId, userId), inArray(brokerStatements.id, plan.statements.map(s => s.id))));
    if (plan.keys.length) await tx.delete(brokerImportAccounts).where(and(eq(brokerImportAccounts.userId, userId), inArray(brokerImportAccounts.accountKey, plan.keys)));
    await clearExclusions(tx, userId, plan.keys);
    // Formats cascade to their parsers, uploads and receipts.
    if (plan.formats.length) await tx.delete(personalFormats).where(and(eq(personalFormats.userId, userId), inArray(personalFormats.id, plan.formats.map(f => f.id))));
    if (plan.nativeJobs.length) await tx.delete(personalImportJobs).where(and(eq(personalImportJobs.userId, userId), inArray(personalImportJobs.id, plan.nativeJobs.map(j => j.id))));
    if (plan.whole.length) await tx.delete(investmentPortfolios).where(and(eq(investmentPortfolios.userId, userId), inArray(investmentPortfolios.id, plan.whole.map(p => p.id))));
    // transactions.account_id has no ON DELETE cascade.
    await tx.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.accountId, accountId)));
    await tx.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)));
    return summary(plan);
  }, { isolationLevel: "serializable" });
}
