import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gcGetAccountDetails, gcGetInstitution, gcGetRequisition, gcGetAccountTransactions, GoCardlessTransaction } from "@/lib/gocardless";
import { checkAccountSyncStatus, recordApiCall } from "@/lib/sync-manager";
import { canCreateLinkedAccount } from "@/lib/plan-limits";
import { PlanTier } from "@prisma/client";

export async function findCategoryByMerchantName(merchantName: string | null): Promise<string | null> {
  if (!merchantName) return null;
  
  try {
    // Look for existing transactions with the same merchantName that have a categoryId
    const existingTransaction = await (prisma as any).transaction.findFirst({
      where: {
        merchantName,
        categoryId: { not: null }
      },
      select: {
        categoryId: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return existingTransaction?.categoryId || null;
  } catch (error) {
    console.error('Error finding category by merchant name:', error);
    return null;
  }
}

async function createTransactionsForAccount(userId: string, accountId: string, externalAccountId: string, lastSyncedAt?: Date, maxDaysHistory?: number) {
  try {
    // Check if we can make API calls for this account
    const syncStatus = await checkAccountSyncStatus(accountId);
    if (!syncStatus.canSync) {
      console.log(`Skipping transaction sync for account ${accountId}: ${syncStatus.reason}`);
      return { 
        created: 0, 
        errors: [`Sync skipped: ${syncStatus.reason}`],
        rateLimited: true
      };
    }

    // Determine date range for fetching transactions
    let dateFrom: Date;
    if (lastSyncedAt) {
      // For existing accounts, only fetch transactions since last sync
      dateFrom = new Date(lastSyncedAt);
      dateFrom.setHours(dateFrom.getHours() - 1); // Add 1 hour buffer
    } else {
      // For new accounts, use institution's maximum days or fallback to 90 days
      const daysToFetch = maxDaysHistory || 90;
      if (maxDaysHistory) {
        console.log(`Using institution-specific transaction history limit: ${maxDaysHistory} days for account ${externalAccountId}`);
      } else {
        console.log(`Using default transaction history limit: 90 days for account ${externalAccountId}`);
      }
      dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - daysToFetch);
    }
    
    const dateFromStr = dateFrom.toISOString().split('T')[0]; // YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`Fetching transactions for account ${externalAccountId} from ${dateFromStr} to ${today} (including newest transactions)`);
    
    // Record API call before making request
    await recordApiCall(accountId, false); // Mark as false initially
    
    let transactions: GoCardlessTransaction[] = [];
    
    try {
      // Fetch transactions with explicit date range to get all transactions up to today
      const transactionData = await gcGetAccountTransactions(externalAccountId, dateFromStr, today);
      transactions = transactionData?.transactions?.booked || [];
      
      // Mark API call as successful
      await recordApiCall(accountId, true);
      
      if (!Array.isArray(transactions) || transactions.length === 0) {
        console.log(`No transactions found for account ${externalAccountId}`);
        return { created: 0, errors: [], apiCallsUsed: 1 };
      }
    } catch (apiError: any) {
      console.error(`API error for account ${externalAccountId}:`, apiError);
      return { 
        created: 0, 
        errors: [`API error: ${apiError.message}`],
        apiCallsUsed: 1
      };
    }

    // Get all existing transaction IDs in one query to avoid N+1 queries
    const existingTransactionIds = await (prisma as any).transaction.findMany({
      where: {
        externalTransactionId: {
          in: transactions.map((t: GoCardlessTransaction) => t.transactionId).filter(Boolean)
        },
        accountId,
        provider: 'gocardless'
      },
      select: { externalTransactionId: true }
    });
    
    const existingIds = new Set(existingTransactionIds.map((t: { externalTransactionId: string }) => t.externalTransactionId));

    const transactionsToCreate = [];
    const errors = [];

    for (const transaction of transactions) {
      try {
        // Skip if transaction already exists
        if (existingIds.has(transaction.transactionId)) {
          console.log(`Transaction ${transaction.transactionId} already exists, skipping`);
          continue;
        }

        // Parse transaction data
        const amount = parseFloat(transaction.transactionAmount?.amount || '0');
        const currency = transaction.transactionAmount?.currency || 'EUR';
        const bookingDate = new Date(transaction.bookingDate);
        const valueDate = transaction.valueDate ? new Date(transaction.valueDate) : null;
        
        // Create description from available information
        const description = 
          transaction.remittanceInformationUnstructured ||
          transaction.remittanceInformationStructured ||
          transaction.creditorName ||
          transaction.debtorName ||
          'Bank Transaction';

        // Extract merchant name and find matching category
        const merchantName = transaction.creditorName || transaction.debtorName || null;
        const categoryId = await findCategoryByMerchantName(merchantName);

        transactionsToCreate.push({
          userId,
          accountId,
          externalTransactionId: transaction.transactionId,
          amount,
          currency,
          description,
          merchantName,
          categoryId,
          date: bookingDate,
          bookingDate,
          valueDate,
          provider: 'gocardless',
          type: amount < 0 ? 'expense' : 'income'
        });
        
      } catch (transactionError: any) {
        console.error(`Failed to prepare transaction ${transaction.transactionId}:`, transactionError);
        errors.push(`Transaction ${transaction.transactionId}: ${transactionError.message}`);
      }
    }

    // Bulk create all transactions at once
    let createdTransactions = [];
    if (transactionsToCreate.length > 0) {
      try {
        createdTransactions = await (prisma as any).transaction.createMany({
          data: transactionsToCreate,
        });
        console.log(`Bulk created ${createdTransactions.count} transactions for account ${accountId}`);
      } catch (bulkError: any) {
        console.error(`Failed to bulk create transactions for account ${accountId}:`, bulkError);
        errors.push(`Bulk create failed: ${bulkError.message}`);
        return { created: 0, errors, transactionIds: [] };
      }
    }

    return { 
      created: createdTransactions.count || 0, 
      errors,
      apiCallsUsed: 1,
      transactionIds: [] // Note: createMany doesn't return IDs in MongoDB
    };
    
  } catch (error: any) {
    console.error(`Failed to fetch transactions for account ${externalAccountId}:`, error);
    return { 
      created: 0, 
      errors: [`Failed to fetch transactions: ${error.message}`],
      apiCallsUsed: 0,
      transactionIds: []
    };
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const body = await request.json().catch(() => ({}));
  let { requisitionId } = body ?? {};

  if (!requisitionId) {
    return NextResponse.json({ error: "Missing requisitionId" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true }
  });
  const userPlan = user?.plan || "FREE";

  const existingLinkedAccounts = await prisma.financialAccount.count({
    where: { userId, linked: true, isArchived: false }
  });

  if (!canCreateLinkedAccount(userPlan as PlanTier, existingLinkedAccounts)) {
    return NextResponse.json({ 
      error: "Plan limit reached. Upgrade your plan to connect more bank accounts." 
    }, { status: 403 });
  }


  try {
    const referenceDbDoc = await (prisma as any).bankConnection.findFirst({ where: { userId, reference: requisitionId } });
    if (!referenceDbDoc) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 400 });
    }

    requisitionId = referenceDbDoc.requisitionId;

    // Fetch requisition and connection data in parallel
    const [requisition, connection] = await Promise.all([
      gcGetRequisition(requisitionId),
      (prisma as any).bankConnection.findFirst({ 
        where: { userId, requisitionId },
        select: {
          institutionId: true,
          institutionName: true,
          transactionTotalDays: true
        }
      })
    ]);

    // Validate requisition status - only process successfully linked requisitions
    // LN = Linked is the successful status we want
    if (requisition.status !== "LN") {
      // Update local status and return appropriate error
      await (prisma as any).bankConnection.updateMany({
        where: { userId, requisitionId },
        data: { status: requisition.status },
      });

      const statusMessages: Record<string, string> = {
        "CR": "Requisition created but not yet authorized by user",
        "GC": "User is granting consent - please complete the authorization",  
        "UA": "User is undergoing authentication - please complete the process",
        "RJ": "Connection was rejected by user or bank",
        "SA": "User is selecting accounts - please complete the selection",
        "GA": "User is giving access - please complete the authorization",
        "ER": "An error occurred during the connection process",
        "SU": "Connection has been suspended",
        "EX": "Connection has expired - please create a new connection"
      };

      return NextResponse.json({ 
        error: "Connection not ready", 
        status: requisition.status,
        message: statusMessages[requisition.status] || `Connection status: ${requisition.status}`,
        requiresUserAction: ["CR", "GC", "UA", "SA", "GA"].includes(requisition.status)
      }, { status: 400 });
    }
    
    const accountIds: string[] = requisition.accounts ?? [];
    const institutionName: string | undefined = connection?.institutionName ?? undefined;
    
    // Fetch institution logo separately if needed (optional optimization)
    let institutionLogo: string | undefined = undefined;
    try {
      if (connection?.institutionId) {
        const inst = await gcGetInstitution(connection.institutionId);
        institutionLogo = inst?.logo ?? undefined;
      }
    } catch {}

    // Update bank connection status
    await (prisma as any).bankConnection.updateMany({
      where: { userId, requisitionId },
      data: { status: requisition.status ?? "LN" },
    });

    // Process accounts sequentially to avoid hitting rate limits too fast
    const accountResults = [];
    let totalApiCalls = 0;
    
    for (const externalAccountId of accountIds) {
      try {
        // Check if account exists first
        const existing = await (prisma as any).financialAccount.findFirst({ 
          where: { userId, externalAccountId },
          select: {
            id: true,
            lastSyncedAt: true,
            apiCallsToday: true,
            name: true
          }
        });

        // Check rate limits before proceeding
        if (existing) {
          const syncStatus = await checkAccountSyncStatus(existing.id);
          if (!syncStatus.canSync) {
            console.log(`Skipping account ${externalAccountId}: ${syncStatus.reason}`);
            accountResults.push({
              accountId: existing.id,
              accountName: existing.name,
              transactionsCreated: 0,
              transactionErrors: [`Skipped: ${syncStatus.reason}`],
              rateLimited: true
            });
            continue;
          }
        }

        // Fetch account details (this uses 1 API call)
        const { details, balances } = await gcGetAccountDetails(externalAccountId);
        const name = details?.account?.name || details?.account?.display_name || "Bank account";
        const currency = balances?.balances?.[0]?.balanceAmount?.currency || "EUR";
        const amountRaw = balances?.balances?.[0]?.balanceAmount?.amount;
        const balance = typeof amountRaw === "string" ? parseFloat(amountRaw) : (typeof amountRaw === "number" ? amountRaw : 0);

        const record = existing
          ? await (prisma as any).financialAccount.update({
            where: { id: existing.id },
            data: { 
              name, 
              currency, 
              balance, 
              provider: "gocardless", 
              connectionId: requisitionId, 
              institutionName, 
              institutionLogo,
              linked: true
            },
          })
          : await (prisma as any).financialAccount.create({
            data: {
              userId,
              name,
              type: "CHECKING" as any,
              currency,
              balance,
              provider: "gocardless",
              externalAccountId,
              connectionId: requisitionId,
              institutionName,
              institutionLogo,
              linked: true,
            },
          });

        // Record API call for account details
        await recordApiCall(record.id, true);
        totalApiCalls += 1;

        // Fetch transactions for this account (this may use another API call)
        console.log(`Fetching transactions for account: ${name} (${externalAccountId})`);
        const transactionResult = await createTransactionsForAccount(
          userId, 
          record.id, 
          externalAccountId, 
          existing?.lastSyncedAt,
          connection?.transactionTotalDays
        );
        
        if (transactionResult.apiCallsUsed) {
          totalApiCalls += transactionResult.apiCallsUsed;
        }
        
        console.log(`Account ${name}: Created ${transactionResult.created} transactions${transactionResult.errors.length > 0 ? ` with ${transactionResult.errors.length} errors` : ''}`);
        
        accountResults.push({
          accountId: record.id,
          accountName: name,
          transactionsCreated: transactionResult.created,
          transactionErrors: transactionResult.errors,
          rateLimited: transactionResult.rateLimited || false,
          apiCallsUsed: (transactionResult.apiCallsUsed || 0) + 1 // +1 for account details
        });
        
      } catch (error: any) {
        console.error(`Failed to process account ${externalAccountId}:`, error);
        accountResults.push({
          accountId: null,
          accountName: "Unknown Account",
          transactionsCreated: 0,
          transactionErrors: [`Failed to process: ${error.message}`],
          failed: true
        });
      }
    }

    // Filter out failed accounts and extract successful ones
    const successfulAccounts = accountResults.filter(result => result.accountId && !result.failed);
    const createdIds = successfulAccounts.map(result => result.accountId).filter(Boolean);
    const rateLimitedCount = accountResults.filter(result => result.rateLimited).length;

    return NextResponse.json({ 
      success: true, 
      createdIds,
      accounts: accountResults,
      summary: {
        totalAccounts: accountResults.length,
        successfulAccounts: successfulAccounts.length,
        rateLimitedAccounts: rateLimitedCount,
        totalTransactions: accountResults.reduce((sum, account) => sum + (account.transactionsCreated || 0), 0),
        totalApiCallsUsed: totalApiCalls
      }
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
