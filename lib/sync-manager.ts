import { prisma } from "@/lib/prisma";

export const DAILY_API_LIMIT = 4;
export const MIN_SYNC_INTERVAL_HOURS = 1; // 24/4 = 6 hours between syncs

export interface SyncStatus {
  canSync: boolean;
  apiCallsUsed: number;
  apiCallsRemaining: number;
  lastSyncAt?: Date;
  nextSyncAvailableAt?: Date;
  reason?: string;
}

export interface AccountSyncResult {
  accountId: string;
  success: boolean;
  transactionsCreated: number;
  errors: string[];
  apiCallsUsed: number;
}

/**
 * Check if an account can be synced based on API rate limits
 */
export async function checkAccountSyncStatus(accountId: string): Promise<SyncStatus> {
  const account = await (prisma as any).financialAccount.findFirst({
    where: { id: accountId, provider: "gocardless" },
    select: {
      apiCallsToday: true,
      lastApiCallAt: true,
      lastSyncedAt: true,
      nextSyncAvailableAt: true,
    }
  });

  if (!account) {
    return {
      canSync: false,
      apiCallsUsed: 0,
      apiCallsRemaining: 0,
      reason: "Account not found or not a GoCardless account"
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Reset daily counter if it's a new day
  let apiCallsToday = account.apiCallsToday;
  let lastApiCallAt = account.lastApiCallAt;
  
  if (lastApiCallAt && lastApiCallAt < today) {
    apiCallsToday = 0;
    lastApiCallAt = null;
  }

  // Check if we've exceeded daily limit
  if (apiCallsToday >= DAILY_API_LIMIT) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return {
      canSync: false,
      apiCallsUsed: apiCallsToday,
      apiCallsRemaining: 0,
      lastSyncAt: account.lastSyncedAt,
      nextSyncAvailableAt: tomorrow,
      reason: `Daily API limit reached (${DAILY_API_LIMIT} calls)`
    };
  }

  // Check if minimum interval has passed since last sync
  if (account.nextSyncAvailableAt && now < account.nextSyncAvailableAt) {
    return {
      canSync: false,
      apiCallsUsed: apiCallsToday,
      apiCallsRemaining: DAILY_API_LIMIT - apiCallsToday,
      lastSyncAt: account.lastSyncedAt,
      nextSyncAvailableAt: account.nextSyncAvailableAt,
      reason: `Minimum sync interval not met. Next sync available at ${account.nextSyncAvailableAt.toLocaleString()}`
    };
  }

  return {
    canSync: true,
    apiCallsUsed: apiCallsToday,
    apiCallsRemaining: DAILY_API_LIMIT - apiCallsToday,
    lastSyncAt: account.lastSyncedAt,
    nextSyncAvailableAt: account.nextSyncAvailableAt
  };
}

/**
 * Record an API call for an account and update sync timing
 */
export async function recordApiCall(accountId: string, success: boolean = true): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const account = await (prisma as any).financialAccount.findFirst({
    where: { id: accountId },
    select: { apiCallsToday: true, lastApiCallAt: true }
  });

  if (!account) return;

  // Reset counter if new day
  let apiCallsToday = account.apiCallsToday;
  if (account.lastApiCallAt && account.lastApiCallAt < today) {
    apiCallsToday = 0;
  }

  // Calculate next available sync time (skip in development)
  let nextSyncAvailableAt = null;

  const updateData: any = {
    apiCallsToday: apiCallsToday + 1,
    lastApiCallAt: now,
    nextSyncAvailableAt
  };

  if (success) {
    updateData.lastSyncedAt = now;
  }

  await (prisma as any).financialAccount.update({
    where: { id: accountId },
    data: updateData
  });
}

/**
 * Get accounts that are due for sync
 */
export async function getAccountsDueForSync(userId: string): Promise<any[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return await (prisma as any).financialAccount.findMany({
    where: {
      userId,
      provider: "gocardless",
      linked: true,
      isArchived: false,
      OR: [
        // Never synced
        { lastSyncedAt: null },
        // Next sync time has passed and haven't hit daily limit
        {
          AND: [
            { nextSyncAvailableAt: { lte: now } },
            {
              OR: [
                { lastApiCallAt: { lt: today } }, // Reset daily counter
                { apiCallsToday: { lt: DAILY_API_LIMIT } }
              ]
            }
          ]
        }
      ]
    },
    select: {
      id: true,
      name: true,
      externalAccountId: true,
      balance: true,
      apiCallsToday: true,
      lastApiCallAt: true,
      lastSyncedAt: true,
      nextSyncAvailableAt: true
    }
  });
}

/**
 * Get comprehensive sync status for all user accounts
 */
export async function getUserAccountsSyncStatus(userId: string): Promise<Record<string, SyncStatus>> {
  const accounts = await (prisma as any).financialAccount.findMany({
    where: {
      userId,
      provider: "gocardless",
      linked: true,
      isArchived: false
    },
    select: {
      id: true,
      apiCallsToday: true,
      lastApiCallAt: true,
      lastSyncedAt: true,
      nextSyncAvailableAt: true
    }
  });

  const statusMap: Record<string, SyncStatus> = {};
  
  for (const account of accounts) {
    statusMap[account.id] = await checkAccountSyncStatus(account.id);
  }

  return statusMap;
}

/**
 * Reset daily counters for all accounts (typically run at midnight)
 */
export async function resetDailyCounters(): Promise<number> {
  const result = await (prisma as any).financialAccount.updateMany({
    where: {
      provider: "gocardless",
      apiCallsToday: { gt: 0 }
    },
    data: {
      apiCallsToday: 0
    }
  });

  return result.count;
}