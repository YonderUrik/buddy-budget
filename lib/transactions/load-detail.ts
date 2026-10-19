/**
 * Loads the detail of one transaction for its owner: the row with its merchant logo, account, origin (bank name or
 * import format), the rule that set its category and the same merchant over the last year.
 */

import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema/accounts";
import { bankAccountLinks, bankConnections } from "@/lib/db/schema/bank-connections";
import { personalFormats } from "@/lib/db/schema/personal-imports";
import { transactions, type Transaction } from "@/lib/db/schema/transactions";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { selectMatchingRule } from "@/lib/categorization/match-rule";
import { loadRuleCandidates } from "@/lib/categorization/resolve";
import { withMerchantLogos } from "@/lib/categorization/merchant-logo/attach";
import { merchantWindowStart, personalFormatId, summarizeMerchant, transactionOrigin, type DetailRule, type TransactionDetailData } from "./detail";

export type TransactionDetail = TransactionDetailData<Transaction & { logoPath: string | null }>;

/** Name of the bank an account is linked to, or null (manual account, or the link was removed). */
async function institutionName(accountId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: bankConnections.institutionName })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(eq(bankAccountLinks.accountId, accountId))
    .limit(1);
  return row?.name ?? null;
}

/** Name the user gave to a personal import format, or null when it was deleted. */
async function formatName(userId: string, formatId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: personalFormats.name })
    .from(personalFormats)
    .where(and(eq(personalFormats.id, formatId), eq(personalFormats.userId, userId)))
    .limit(1);
  return row?.name ?? null;
}

/** The user's rule that matches the transaction today, only if it still gives the category the transaction has. */
async function matchingRule(userId: string, transaction: Transaction): Promise<DetailRule | null> {
  const rules = await loadRuleCandidates(userId);
  const isIncome = Number(transaction.amount) > 0;
  const texts = [transaction.description, transaction.rawDescription].filter((text): text is string => Boolean(text));
  for (const text of texts) {
    const rule = selectMatchingRule(merchantKey(text), isIncome, rules);
    if (rule && rule.categoryId === transaction.categoryId) return { id: rule.id, matchType: rule.matchType, pattern: rule.pattern };
  }
  return null;
}

/** Detail of transaction `id` if it belongs to `userId`, otherwise null. */
export async function loadTransactionDetail(userId: string, id: string, today = new Date()): Promise<TransactionDetail | null> {
  const [row] = await db
    .select({ transaction: transactions, account: { id: accounts.id, name: accounts.name, isDemo: accounts.isDemo } })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  if (!row) return null;
  const { transaction, account } = row;

  const formatId = personalFormatId(transaction.externalId);
  const [institution, format, rule, yearRows, [withLogo]] = await Promise.all([
    transaction.source === "auto" ? institutionName(transaction.accountId) : Promise.resolve(null),
    formatId ? formatName(userId, formatId) : Promise.resolve(null),
    transaction.categorySource === "regola" ? matchingRule(userId, transaction) : Promise.resolve(null),
    db
      .select({ id: transactions.id, date: transactions.date, description: transactions.description, amount: transactions.amount, excludedAmount: transactions.excludedAmount })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), gte(transactions.date, merchantWindowStart(today)))),
    withMerchantLogos([transaction], (t) => ({ label: t.description, texts: [t.rawDescription], isExpense: Number(t.amount) < 0 }), userId),
  ]);

  return {
    transaction: withLogo,
    account: account ? { id: account.id, name: account.name } : null,
    origin: transactionOrigin({ source: transaction.source, externalId: transaction.externalId, accountIsDemo: account?.isDemo ?? false }, { institution, format }),
    rule,
    merchant: summarizeMerchant(transaction, yearRows),
  };
}
