import "server-only";
import { toDateKey } from "@/lib/calc/net-worth";
import type { Account } from "@/lib/db/schema/accounts";
import { loadTransactionRows } from "@/lib/liquidity/transactions-list.server";
import { resolveProfile } from "@/lib/localization/config";
import { requestLogger } from "@/lib/observability";
import { redisSyncJobStore } from "@/lib/sync-jobs/redis-store";
import type { SyncJob } from "@/lib/sync-jobs/types";
import { toJobView } from "@/lib/sync-jobs/view";
import { accountTrendFrom, buildAccountExtras } from "./accounts";
import { loadBankConnectionStatuses } from "./data.server";
import type { AccountExtras } from "./schemas";

/** Open sync jobs of the user as `/api/sync-jobs` lists them; empty (logged) when Redis is unavailable. */
async function loadOpenSyncJobs(userId: string, now: Date): Promise<SyncJob[]> {
  try {
    const jobs = await redisSyncJobStore.listJobs(userId);
    return jobs.filter((job) => !job.dismissed).map((job) => toJobView(job, now));
  } catch (error) {
    requestLogger().warn("accounts.sync_jobs.unavailable", { error });
    return [];
  }
}

/** `accounts` with the extras of `GET /api/accounts?include=trend,health`. */
export async function loadAccountsWithExtras(
  user: { id: string; productCountry?: string | null; language?: string | null },
  accounts: Account[],
  options: { today: Date; now?: Date },
): Promise<(Account & AccountExtras)[]> {
  const now = options.now ?? new Date();
  const [transactions, connections, syncJobs] = await Promise.all([
    loadTransactionRows(user.id, { from: toDateKey(accountTrendFrom(options.today)), to: toDateKey(options.today), direction: "tutte" }),
    loadBankConnectionStatuses(user.id, now),
    loadOpenSyncJobs(user.id, now),
  ]);
  return buildAccountExtras({ accounts, transactions, connections, syncJobs, today: options.today, now, language: resolveProfile(user).language });
}
