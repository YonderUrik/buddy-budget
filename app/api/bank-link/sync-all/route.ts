import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccountsDueForSync } from "@/lib/sync-manager";
import { gcGetAccountTransactions, gcGetAccountDetails, GoCardlessTransaction } from "@/lib/gocardless";
import { checkAccountSyncStatus, recordApiCall } from "@/lib/sync-manager";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const body = await request.json().catch(() => ({}));
  const { force = false, background = false } = body ?? {};

  try {
    // Get accounts that need syncing
    const accountsDue = await getAccountsDueForSync(userId);
    
    if (accountsDue.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No accounts need syncing",
        syncResults: [],
        summary: {
          totalAccounts: 0,
          synced: 0,
          skipped: 0,
          errors: 0
        }
      });
    }

    const syncResults = [];
    let totalTransactions = 0;
    let totalErrors = 0;

    // Sync accounts sequentially to respect rate limits
    for (const account of accountsDue) {
      try {
        console.log(`Auto-syncing account: ${account.name} (${account.id})`);
        
        // Check if account can sync (unless forced)
        if (!force) {
          const syncStatus = await checkAccountSyncStatus(account.id);
          if (!syncStatus.canSync) {
            syncResults.push({
              accountId: account.id,
              accountName: account.name,
              success: false,
              reason: syncStatus.reason,
              transactionsCreated: 0,
              skipped: true
            });
            continue;
          }
        }

        // Get connection data for transaction limits
        const connection = await (prisma as any).bankConnection.findFirst({
          where: { 
            userId,
            requisitionId: account.connectionId // connectionId stores the requisitionId
          },
          select: {
            transactionTotalDays: true
          }
        });

        // Perform sync
        const syncResult = await syncAccount(account, userId, connection?.transactionTotalDays);
        syncResults.push({
          accountId: account.id,
          accountName: account.name,
          success: syncResult.success,
          transactionsCreated: syncResult.transactionsCreated,
          transactionsSkipped: syncResult.transactionsSkipped,
          errors: syncResult.errors,
          apiCallsUsed: syncResult.apiCallsUsed,
          balanceUpdated: syncResult.balanceUpdated,
          newBalance: syncResult.newBalance
        });

        totalTransactions += syncResult.transactionsCreated;
        if (syncResult.errors.length > 0) {
          totalErrors += syncResult.errors.length;
        }

      } catch (error: any) {
        console.error(`Failed to sync account ${account.name}:`, error);
        syncResults.push({
          accountId: account.id,
          accountName: account.name,
          success: false,
          reason: error.message,
          transactionsCreated: 0,
          errors: [error.message]
        });
        totalErrors++;
      }
    }

    const summary = {
      totalAccounts: accountsDue.length,
      processed: syncResults.length,
      synced: syncResults.filter(r => r.success).length,
      skipped: syncResults.filter(r => r.skipped).length,
      errors: totalErrors,
      totalTransactions
    };

    return NextResponse.json({
      success: true,
      message: `Synced ${summary.synced} of ${summary.totalAccounts} accounts`,
      syncResults,
      summary
    });

  } catch (error: any) {
    console.error("Bulk sync error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  try {
    // Get accounts that need syncing
    const accountsDue = await getAccountsDueForSync(userId);
    
    // Get all GoCardless accounts for comparison
    const allAccounts = await (prisma as any).financialAccount.findMany({
      where: {
        userId,
        provider: "gocardless",
        linked: true,
        isArchived: false
      },
      select: {
        id: true,
        name: true,
        lastSyncedAt: true,
        apiCallsToday: true
      }
    });

    return NextResponse.json({
      accountsDue: accountsDue.length,
      totalAccounts: allAccounts.length,
      accounts: accountsDue.map(account => ({
        id: account.id,
        name: account.name,
        lastSyncedAt: account.lastSyncedAt,
        apiCallsUsed: account.apiCallsToday || 0
      }))
    });

  } catch (error: any) {
    console.error("Sync status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function syncAccount(account: any, userId: string, maxDaysHistory?: number) {
  const startTime = Date.now();
  let apiCallsUsed = 0;
  
  try {
    // Determine date range based on last transaction date
    let dateFrom: Date;
    
    // Get the most recent transaction for this account
    const lastTransaction = await (prisma as any).transaction.findFirst({
      where: {
        accountId: account.id,
        provider: 'gocardless'
      },
      orderBy: {
        date: 'desc'
      },
      select: {
        date: true
      }
    });

    if (lastTransaction && lastTransaction.date) {
      // Start from the last transaction date with a small buffer
      dateFrom = new Date(lastTransaction.date);
      dateFrom.setHours(dateFrom.getHours() - 1);
    } else {
      // For accounts with no transactions, use institution's max days or fallback to 30 days (smaller range for bulk sync)
      const daysToFetch = maxDaysHistory || 90
      if (maxDaysHistory) {
        console.log(`Using institution-specific transaction history limit (capped at 30 for bulk sync): ${daysToFetch} days for account ${account.name}`);
      } else {
        console.log(`Using default transaction history limit for bulk sync: 30 days for account ${account.name}`);
      }
      dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - daysToFetch);
    }

    // Limit how far back we go for performance, but respect institution limits
    const maxDateBack = new Date();
    const maxDaysBack = maxDaysHistory || 90;
    maxDateBack.setDate(maxDateBack.getDate() - maxDaysBack);
    if (dateFrom < maxDateBack) {
      dateFrom = maxDateBack;
    }

    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`Bulk syncing ${account.name} from ${dateFromStr} to ${today}`);

    // Record API call
    await recordApiCall(account.id, false);
    apiCallsUsed++;

    try {
      // Fetch transactions
      const transactionData = await gcGetAccountTransactions(account.externalAccountId, dateFromStr, today);
      const transactions: GoCardlessTransaction[] = transactionData?.transactions?.booked || [];
      
      // Mark API call as successful
      await recordApiCall(account.id, true);

      if (!Array.isArray(transactions) || transactions.length === 0) {
        return {
          success: true,
          transactionsCreated: 0,
          transactionsSkipped: 0,
          errors: [],
          apiCallsUsed,
          balanceUpdated: false
        };
      }

      // Get existing transaction IDs
      const existingTransactionIds = await (prisma as any).transaction.findMany({
        where: {
          externalTransactionId: {
            in: transactions.map((t: GoCardlessTransaction) => t.transactionId).filter(Boolean)
          },
          provider: 'gocardless'
        },
        select: { externalTransactionId: true }
      });

      const existingIds = new Set(existingTransactionIds.map((t: { externalTransactionId: string }) => t.externalTransactionId));
      const transactionsToCreate = [];
      const errors = [];
      let skippedCount = 0;

      for (const transaction of transactions) {
        try {
          if (existingIds.has(transaction.transactionId)) {
            skippedCount++;
            continue;
          }

          const amount = parseFloat(transaction.transactionAmount?.amount || '0');
          const currency = transaction.transactionAmount?.currency || 'EUR';
          const bookingDate = new Date(transaction.bookingDate);
          const valueDate = transaction.valueDate ? new Date(transaction.valueDate) : null;

          const description = 
            transaction.remittanceInformationUnstructured ||
            transaction.remittanceInformationStructured ||
            transaction.creditorName ||
            transaction.debtorName ||
            'Bank Transaction';

          transactionsToCreate.push({
            userId: userId,
            accountId: account.id,
            externalTransactionId: transaction.transactionId,
            amount,
            currency,
            description,
            merchantName: transaction.creditorName || transaction.debtorName || null,
            categoryCode: transaction.merchantCategoryCode || null,
            date: bookingDate,
            bookingDate,
            valueDate,
            provider: 'gocardless',
            raw: transaction as any,
          });

        } catch (transactionError: any) {
          console.error(`Failed to prepare transaction ${transaction.transactionId}:`, transactionError);
          errors.push(`Transaction ${transaction.transactionId}: ${transactionError.message}`);
        }
      }

      // Bulk create transactions
      let createdCount = 0;
      if (transactionsToCreate.length > 0) {
        try {
          const createdTransactions = await (prisma as any).transaction.createMany({
            data: transactionsToCreate,
          });
          createdCount = createdTransactions.count || 0;
        } catch (bulkError: any) {
          console.error(`Failed to bulk create transactions:`, bulkError);
          errors.push(`Bulk create failed: ${bulkError.message}`);
        }
      }

      // After syncing transactions, also update account balance if it has changed
      let balanceUpdated = false;
      let newBalance: number | undefined = undefined;
      
      try {
        // Fetch current account details to get updated balance
        console.log(`Fetching updated balance for account: ${account.name}`);
        const { balances } = await gcGetAccountDetails(account.externalAccountId);
        
        const amountRaw = balances?.balances?.[0]?.balanceAmount?.amount;
        const currentBalance = typeof amountRaw === "string" ? parseFloat(amountRaw) : (typeof amountRaw === "number" ? amountRaw : 0);
        
        // Check if balance has changed (with small tolerance for floating point precision)
        const balanceDifference = Math.abs(currentBalance - (account.balance || 0));
        if (balanceDifference > 0.01) {
          // Update account balance in database
          await (prisma as any).financialAccount.update({
            where: { id: account.id },
            data: { balance: currentBalance }
          });
          
          balanceUpdated = true;
          newBalance = currentBalance;
          console.log(`Updated balance for ${account.name}: ${account.balance || 0} → ${currentBalance}`);
        }
        
      } catch (balanceError: any) {
        console.error(`Failed to update balance for ${account.name}:`, balanceError);
        errors.push(`Balance update failed: ${balanceError.message}`);
      }

      const syncDuration = Date.now() - startTime;
      console.log(`Bulk sync completed for ${account.name} in ${syncDuration}ms: ${createdCount} created, ${skippedCount} skipped, balance updated: ${balanceUpdated}`);

      return {
        success: true,
        transactionsCreated: createdCount,
        transactionsSkipped: skippedCount,
        errors,
        apiCallsUsed,
        balanceUpdated,
        newBalance
      };

    } catch (apiError: any) {
      console.error(`API error during bulk sync for ${account.name}:`, apiError);
      return {
        success: false,
        transactionsCreated: 0,
        transactionsSkipped: 0,
        errors: [`API error: ${apiError.message}`],
        apiCallsUsed,
        balanceUpdated: false
      };
    }

  } catch (error: any) {
    console.error(`Bulk sync failed for account ${account.name}:`, error);
    return {
      success: false,
      transactionsCreated: 0,
      transactionsSkipped: 0,
      errors: [`Sync failed: ${error.message}`],
      apiCallsUsed,
      balanceUpdated: false
    };
  }
}