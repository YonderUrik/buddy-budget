/**
 * Accounts list extras computed on the server (gaps.md G5): the same functions `app/(app)/liquidita/conti/page.tsx`
 * runs in the browser (30-day balance trend, connection health, status line, bank grouping). Pure.
 */
import { localizedAccountStatus, type AccountSyncInfo } from "@/components/domain/accounts/account-status";
import { addDays } from "@/lib/calc/net-worth";
import type { Account } from "@/lib/db/schema/accounts";
import type { Transaction } from "@/lib/db/schema/transactions";
import { computeConnectionHealth, needsRenewal } from "@/lib/gocardless/connection-health";
import { buildAccountBalanceSeries } from "@/lib/liquidity/account-series";
import type { Language } from "@/lib/localization/config";
import { isAccountSyncing } from "@/lib/sync-jobs/view";
import type { SyncJob } from "@/lib/sync-jobs/types";
import type { BankConnectionStatus } from "./data.server";
import type { AccountExtras } from "./schemas";

/** Days of history in each account's trend, as on the web. */
export const ACCOUNT_TREND_DAYS = 30;

/** First day of the trend window for `today`. */
export function accountTrendFrom(today: Date): Date {
  return addDays(today, -ACCOUNT_TREND_DAYS);
}

export interface AccountExtrasInput {
  accounts: Account[];
  /** Transactions from `accountTrendFrom(today)` to today. */
  transactions: Transaction[];
  connections: BankConnectionStatus[];
  syncJobs: SyncJob[];
  today: Date;
  now: Date;
  language: Language;
}

/** Each account with its bank, trend, connection health and localized status line. */
export function buildAccountExtras(input: AccountExtrasInput): (Account & AccountExtras)[] {
  const { buildAccountStatus } = localizedAccountStatus(input.language);
  const from = accountTrendFrom(input.today);
  const connectionByAccount = new Map(input.connections.map((c) => [c.accountId, c]));
  return input.accounts.map((account) => {
    const connection = connectionByAccount.get(account.id);
    const isAuto = account.source === "auto";
    const health = connection ? computeConnectionHealth(connection, input.today) : null;
    const syncing = isAccountSyncing(input.syncJobs, account.id);
    const syncInfo: AccountSyncInfo | undefined = connection
      ? { lastSyncedAt: connection.lastSyncedAt, eligible: connection.eligible, nextEligibleAt: connection.nextEligibleAt, syncsRemainingToday: connection.syncsRemainingToday }
      : undefined;
    const reconnect = health ? needsRenewal(health.state) : false;
    return {
      ...account,
      bankName: isAuto ? (connection?.institutionName ?? null) : null,
      trend: isAuto ? buildAccountBalanceSeries(account, input.transactions, from, input.today).map((point) => point.value) : null,
      health:
        connection && health
          ? {
              connectionId: connection.connectionId,
              institutionName: connection.institutionName,
              provider: connection.provider,
              state: health.state,
              needsRenewal: reconnect,
              daysLeft: health.daysLeft,
              consentExpiresAt: connection.consentExpiresAt,
              lastSyncedAt: connection.lastSyncedAt,
              syncing,
              eligible: connection.eligible,
              nextEligibleAt: connection.nextEligibleAt,
              syncsRemainingToday: connection.syncsRemainingToday,
            }
          : null,
      status: buildAccountStatus({ isAuto, needsReconnect: reconnect, syncing, syncInfo, now: input.now }),
    };
  });
}
