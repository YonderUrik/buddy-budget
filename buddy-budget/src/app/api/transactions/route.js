import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getExchangeRates } from "@/components/yahooFinance/exchange-rates";
import { ObjectId } from "bson";
import dayjs from "dayjs";


export async function GET(request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const daysPerPage = parseInt(searchParams.get('daysPerPage') || '5', 10); // Default to 5 days per page
  const searchTerm = searchParams.get('searchTerm') || '';
  const types = searchParams.get('type')?.split(',') || [];
  const categoryIds = searchParams.get('categoryId')?.split(',') || [];
  const sourceAccountIds = searchParams.get('sourceAccountId')?.split(',') || [];
  const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')) : null;
  const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')) : null;

  try {
    // Build match conditions for search and filters
    const matchConditions = { userId: { $oid: userId } };

    // Add type filter
    if (types.length > 0) {
      matchConditions.type = { $in: types };
    }

    // Add category filter
    if (categoryIds.length > 0) {
      matchConditions.categoryId = { $in: categoryIds.map(id => ({ $oid: id })) };
    }

    // Add source account filter
    if (sourceAccountIds.length > 0) {
      matchConditions.sourceAccountId = { $in: sourceAccountIds.map(id => ({ $oid: id })) };
    }

    // Add date range filter
    if (dateFrom || dateTo) {
      matchConditions.date = {};
      if (dateFrom) {
        matchConditions.date.$gte = { $date: dateFrom.toISOString() };
      }
      if (dateTo) {
        matchConditions.date.$lte = { $date: dateTo.toISOString() };
      }
    }

    // Add search term condition
    if (searchTerm) {
      // Search in description (case insensitive)
      matchConditions.description = { $regex: searchTerm, $options: "i" };
    }

    // Use aggregation to group transactions by day and include transaction list
    const aggregationResult = await prisma.transaction.aggregateRaw({
      pipeline: [
        {
          $match: matchConditions
        },
        {
          $sort: {
            date: -1,
            createdAt: -1
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
              day: { $dayOfMonth: "$date" }
            },
            date: {
              $first: "$date"
            },
            transactionList: {
              $push: "$$ROOT"
            }
          }
        },
        {
          $project: {
            _id: 0,
            date: 1,
            transactionList: 1
          }
        },
        {
          $sort: {
            date: -1
          }
        },
        {
          $facet: {
            paginatedResults: [
              { $skip: (page - 1) * daysPerPage },
              { $limit: daysPerPage }
            ],
            totalCount: [
              { $count: "count" }
            ]
          }
        }
      ]
    });

    const groupedDays = aggregationResult[0].paginatedResults || [];
    const totalCount = aggregationResult[0].totalCount.length > 0
      ? aggregationResult[0].totalCount[0].count
      : 0;

    const totalPages = Math.ceil(totalCount / daysPerPage);

    // For each day group, we need to fetch the complete transaction data with relations
    const enrichedGroups = await Promise.all(
      groupedDays.map(async (dayGroup) => {
        // Extract transaction IDs from the group
        const transactionIds = dayGroup.transactionList.map(t => t._id.$oid);

        // Fetch complete transaction data with relations
        const transactions = await prisma.transaction.findMany({
          where: {
            id: {
              in: transactionIds
            }
          },
          include: {
            category: true,
            sourceAccount: true,
            destinationAccount: true,
          },
          orderBy: [
            { date: 'desc' },
            { createdAt: 'desc' }
          ]
        });

        // Format the date for the group key
        const dayDate = dayjs(dayGroup.date.$date).format('YYYY-MM-DD');

        return {
          date: dayDate,
          transactionList: transactions
        };
      })
    );

    return NextResponse.json({
      groupedTransactions: enrichedGroups,
      currentPage: page,
      totalPages,
      totalDays: totalCount,
      daysOnThisPage: enrichedGroups.length,
    });

  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// You can also add POST, PUT, DELETE handlers here later for CRUD operations 

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const primaryCurrency = session.user.primaryCurrency;

    const body = await request.json();

    const { date, description, amount, type, categoryId, sourceAccountId, destinationAccountId } = body;

    if (!date || !description || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (type === "transfer" && !destinationAccountId) {
      return NextResponse.json({ error: "Destination account is required for transfer type" }, { status: 400 });
    }

    if ((type === 'expense' || type === 'income') && (!categoryId || !sourceAccountId)) {
      return NextResponse.json({ error: "Category and source account are required for expense or income type" }, { status: 400 });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const transactionDate = new Date(date);

    let category;
    if (categoryId) {
      category = await prisma.category.findUnique({
        where: {
          id: categoryId,
          type: type,
          userId: userId,
        },
      });

      if (!category) {
        return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      }
    }

    let sourceAccount;
    if (sourceAccountId) {
      sourceAccount = await prisma.account.findUnique({
        where: {
          id: sourceAccountId,
          userId: userId,
        },
      });

      if (!sourceAccount) {
        return NextResponse.json({ error: "Invalid source account" }, { status: 400 });
      }
    }

    let destinationAccount;
    if (destinationAccountId) {
      destinationAccount = await prisma.account.findUnique({
        where: {
          id: destinationAccountId,
          userId: userId,
        },
      });

      if (!destinationAccount) {
        return NextResponse.json({ error: "Invalid destination account" }, { status: 400 });
      }
    }


    const result = await prisma.$transaction(async (tx) => {
      const exchangeRateCache = {};
      const getCachedExchangeRate = async (fromCurrency, toCurrency, effectiveDate) => {
        if (!fromCurrency || !toCurrency) {
          // Should not happen if accounts are validated
          console.error("Attempted to get exchange rate with undefined currency");
          return 1;
        }
        if (fromCurrency === toCurrency) {
          return 1;
        }
        const cacheKey = `${fromCurrency}_${toCurrency}_${effectiveDate ? effectiveDate.toISOString().split('T')[0] : 'latest'}`;
        if (exchangeRateCache[cacheKey]) {
          return exchangeRateCache[cacheKey];
        }
        // Assuming getExchangeRates can take a date object or null/undefined for latest
        const rate = await getExchangeRates(fromCurrency, toCurrency, effectiveDate);
        exchangeRateCache[cacheKey] = rate;
        return rate;
      };

      // Convert the amount of source account to primary currency
      let txConvertedSourceAmount = numericAmount;
      if (sourceAccount && sourceAccount.currency !== primaryCurrency) {
        const rate = await getCachedExchangeRate(sourceAccount.currency, primaryCurrency, transactionDate);
        txConvertedSourceAmount = numericAmount * rate;
      }

      let txConvertedDestinationAmount = null;
      // Convert the amount to the destination account to source account currency and then to primary currency
      if (type === 'transfer' && sourceAccount && destinationAccount) {
        const rateSourceToDest = await getCachedExchangeRate(sourceAccount.currency, destinationAccount.currency, transactionDate);
        txConvertedDestinationAmount = numericAmount * rateSourceToDest;


        if (destinationAccount.currency !== primaryCurrency) {
          const rateDestToPrimary = await getCachedExchangeRate(destinationAccount.currency, primaryCurrency, transactionDate);
          txConvertedDestinationAmount = txConvertedDestinationAmount * rateDestToPrimary;
        }
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          date: transactionDate,
          description,
          amount: numericAmount, // Original amount in sourceAccount.currency
          convertedSourceAmount: txConvertedSourceAmount, // Amount from source, in primaryCurrency
          convertedDestinationAmount: txConvertedDestinationAmount, // Amount to destination, in primaryCurrency (for transfers)
          type,
          categoryId: categoryId || null,
          sourceAccountId: sourceAccountId || null,
          destinationAccountId: destinationAccountId || null,
        },
      });

      let lastWealthSnapshot = await tx.wealthSnapshot.findFirst({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        select: {
          userId: true,
          timestamp: true,
          liquidityAccounts: true,
          totalValue: true,
        },
      });

      const baseSnapshotForCurrentUpdate = lastWealthSnapshot || {
        userId,
        timestamp: new Date(0), // Effectively a new state if no previous snapshot
        liquidityAccounts: [],
        totalValue: 0,
      };


      // UPDATE ACCOUNTS BALANCE
      if (type === 'expense' && sourceAccount) {
        await tx.account.update({
          where: { id: sourceAccountId },
          data: { value: { decrement: numericAmount } },
        });
      } else if (type === 'income' && sourceAccount) {
        await tx.account.update({
          where: { id: sourceAccountId },
          data: { value: { increment: numericAmount } },
        });
      } else if (type === 'transfer' && sourceAccount && destinationAccount) {
        await tx.account.update({
          where: { id: sourceAccountId },
          data: { value: { decrement: numericAmount } },
        });

        const rateSourceToDest = await getCachedExchangeRate(sourceAccount.currency, destinationAccount.currency, transactionDate);
        const amountInDestinationCurrency = numericAmount * rateSourceToDest;

        await tx.account.update({
          where: { id: destinationAccountId },
          data: { value: { increment: amountInDestinationCurrency } },
        });
      }

      // Wealth Snapshot Update Logic
      if (transactionDate >= lastWealthSnapshot.timestamp) {
        // Transaction is "current" or "future" relative to the last snapshot, or it's the first snapshot.
        // We create a new snapshot entry reflecting the state *after* this transaction.
        let newTotalValue = baseSnapshotForCurrentUpdate.totalValue;
        let updatedLiquidityAccounts = [...baseSnapshotForCurrentUpdate.liquidityAccounts.map(acc => ({ ...acc }))]; // Deep copy

        if (type === 'expense') {
          const rateSourceToPrimary = await getCachedExchangeRate(sourceAccount.currency, primaryCurrency, transactionDate);
          const changeInPrimary = numericAmount * rateSourceToPrimary;
          newTotalValue -= changeInPrimary;

          const accIndex = updatedLiquidityAccounts.findIndex(a => a.id === sourceAccountId);
          if (accIndex > -1) {
            updatedLiquidityAccounts[accIndex].value -= numericAmount;
            updatedLiquidityAccounts[accIndex].convertedValue -= changeInPrimary;
          } else {
            // If account not in snapshot, add it (simplified: assumes account details are available)
            // This part might need more robust handling based on how accounts are added to snapshots initially
            updatedLiquidityAccounts.push({
              id: sourceAccountId,
              value: -numericAmount, // This assumes initial value was 0 before this tx if not found
              convertedValue: -changeInPrimary,
            });
          }

        } else if (type === 'income' && sourceAccount) {
          const rateSourceToPrimary = await getCachedExchangeRate(sourceAccount.currency, primaryCurrency, transactionDate);
          const changeInPrimary = numericAmount * rateSourceToPrimary;
          newTotalValue += changeInPrimary;

          const accIndex = updatedLiquidityAccounts.findIndex(a => a.id === sourceAccountId);
          if (accIndex > -1) {
            updatedLiquidityAccounts[accIndex].value += numericAmount;
            updatedLiquidityAccounts[accIndex].convertedValue += changeInPrimary;
          } else {
            updatedLiquidityAccounts.push({
              id: sourceAccountId,
              value: numericAmount,
              convertedValue: changeInPrimary
            });
          }

        } else if (type === 'transfer') {
          const rateSourceToPrimary = await getCachedExchangeRate(sourceAccount.currency, primaryCurrency, transactionDate);
          const rateDestToPrimary = await getCachedExchangeRate(destinationAccount.currency, primaryCurrency, transactionDate);
          const rateSourceToDest = await getCachedExchangeRate(sourceAccount.currency, destinationAccount.currency, transactionDate);

          const amountInDestinationCurrency = numericAmount * rateSourceToDest;

          const sourceChangeInPrimary = numericAmount * rateSourceToPrimary;
          const destChangeInPrimary = amountInDestinationCurrency * rateDestToPrimary;

          newTotalValue = newTotalValue - sourceChangeInPrimary + destChangeInPrimary;

          // Source Account
          const sourceAccIndex = updatedLiquidityAccounts.findIndex(a => a.id === sourceAccountId);
          if (sourceAccIndex > -1) {
            updatedLiquidityAccounts[sourceAccIndex].value -= numericAmount;
            updatedLiquidityAccounts[sourceAccIndex].convertedValue -= sourceChangeInPrimary;
          } else {
            updatedLiquidityAccounts.push({
              id: sourceAccountId,
              value: -numericAmount,
              convertedValue: -sourceChangeInPrimary
            });
          }

          // Destination Account
          const destAccIndex = updatedLiquidityAccounts.findIndex(a => a.id === destinationAccountId);
          if (destAccIndex > -1) {
            updatedLiquidityAccounts[destAccIndex].value += amountInDestinationCurrency;
            updatedLiquidityAccounts[destAccIndex].convertedValue += destChangeInPrimary;
          } else {
            updatedLiquidityAccounts.push({
              id: destinationAccountId,
              value: amountInDestinationCurrency,
              convertedValue: destChangeInPrimary
            });
          }
        }

        await tx.wealthSnapshot.create({
          data: {
            userId,
            timestamp: transactionDate,
            liquidityAccounts: updatedLiquidityAccounts,
            totalValue: newTotalValue,
          }
        });

      } else {
        // Transaction is in the past, before the last snapshot.
        // We need to create a historical snapshot.
        const nextSnapshot = await tx.wealthSnapshot.findFirst({
          where: {
            userId,
            timestamp: { gt: transactionDate },
          },
          orderBy: { timestamp: 'asc' },
          // select needed fields if not all
        });

        if (!nextSnapshot) {
          // This case should ideally not be hit if transactionDate < lastWealthSnapshot.timestamp
          // and lastWealthSnapshot exists. It implies a gap or an issue.
          // For robustness, one might log an error or decide on a fallback.
          // For now, we proceed assuming nextSnapshot is found if this branch is hit.
          // If this is a genuine edge case (e.g. inserting a tx older than ALL existing snapshots),
          // then nextSnapshot would be null, and the logic below would fail.
          // A truly robust solution here would create a snapshot from scratch based on this tx,
          // and then replay subsequent transactions if any. This is complex.
          // The current logic relies on a 'nextSnapshot' to reverse-calculate from.
          console.error("Could not find next snapshot for a past transaction. Snapshot may be inaccurate.");
          // Potentially throw error or return, as calculation will be problematic.
        }

        // Fallback if nextSnapshot is null, to prevent crash, though data will be incomplete/potentially wrong
        const baseForPastSnapshot = nextSnapshot || { liquidityAccounts: [], totalValue: 0, userId };


        let historicalTotalValue = baseForPastSnapshot.totalValue;
        let historicalLiquidityAccounts = [...baseForPastSnapshot.liquidityAccounts.map(acc => ({ ...acc }))]; // Deep copy


        if (type === 'expense' && sourceAccount) {
          const rateSourceToPrimary = await getCachedExchangeRate(sourceAccount.currency, primaryCurrency, transactionDate);
          const changeInPrimary = numericAmount * rateSourceToPrimary;
          // To get state *before* this expense (from nextSnapshot's perspective), add back
          historicalTotalValue += changeInPrimary;

          const accIndex = historicalLiquidityAccounts.findIndex(a => a.id === sourceAccountId);
          if (accIndex > -1) {
            historicalLiquidityAccounts[accIndex].value += numericAmount;
            historicalLiquidityAccounts[accIndex].convertedValue += changeInPrimary;
          } else {
            historicalLiquidityAccounts.push({
              id: sourceAccountId,
              value: numericAmount, // Value *before* this expense was numericAmount higher
              convertedValue: changeInPrimary,
            });
          }

        } else if (type === 'income' && sourceAccount) {
          const rateSourceToPrimary = await getCachedExchangeRate(sourceAccount.currency, primaryCurrency, transactionDate);
          const changeInPrimary = numericAmount * rateSourceToPrimary;
          // To get state *before* this income, subtract
          historicalTotalValue -= changeInPrimary;

          const accIndex = historicalLiquidityAccounts.findIndex(a => a.id === sourceAccountId);
          if (accIndex > -1) {
            historicalLiquidityAccounts[accIndex].value -= numericAmount;
            historicalLiquidityAccounts[accIndex].convertedValue -= changeInPrimary;
          } else {
            historicalLiquidityAccounts.push({
              id: sourceAccountId,
              value: -numericAmount,
              convertedValue: -changeInPrimary,
            });
          }

        } else if (type === 'transfer' && sourceAccount && destinationAccount) {
          const rateSourceToPrimary = await getCachedExchangeRate(sourceAccount.currency, primaryCurrency, transactionDate);
          const rateDestToPrimary = await getCachedExchangeRate(destinationAccount.currency, primaryCurrency, transactionDate);
          const rateSourceToDest = await getCachedExchangeRate(sourceAccount.currency, destinationAccount.currency, transactionDate);

          const amountInDestinationCurrency = numericAmount * rateSourceToDest;
          const sourceChangeInPrimary = numericAmount * rateSourceToPrimary;
          const destChangeInPrimary = amountInDestinationCurrency * rateDestToPrimary;

          // To reverse: money went from source to dest.
          // So, source was higher, dest was lower.
          historicalTotalValue = historicalTotalValue + sourceChangeInPrimary - destChangeInPrimary;

          // Source Account (was higher before transfer)
          const sourceAccIndex = historicalLiquidityAccounts.findIndex(a => a.id === sourceAccountId);
          if (sourceAccIndex > -1) {
            historicalLiquidityAccounts[sourceAccIndex].value += numericAmount;
            historicalLiquidityAccounts[sourceAccIndex].convertedValue += sourceChangeInPrimary;
          } else {
            historicalLiquidityAccounts.push({
              id: sourceAccountId,
              value: numericAmount,
              convertedValue: sourceChangeInPrimary,
            });
          }

          // Destination Account (was lower before transfer)
          const destAccIndex = historicalLiquidityAccounts.findIndex(a => a.id === destinationAccountId);
          if (destAccIndex > -1) {
            historicalLiquidityAccounts[destAccIndex].value -= amountInDestinationCurrency;
            historicalLiquidityAccounts[destAccIndex].convertedValue -= destChangeInPrimary;
          } else {
            historicalLiquidityAccounts.push({
              id: destinationAccountId,
              value: -amountInDestinationCurrency,
              convertedValue: -destChangeInPrimary,
            });
          }
        }

        // Create the new historical snapshot
        if (nextSnapshot) { // Only create if we had a valid base
          await tx.wealthSnapshot.create({
            data: {
              userId,
              timestamp: transactionDate,
              liquidityAccounts: historicalLiquidityAccounts,
              totalValue: historicalTotalValue,
            }
          });
        }
      }
      return { success: true, data: transaction };
    })

    if (result.success) {
      return NextResponse.json(result.data, { status: 201 });
    } else {
      return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
    }

  } catch (error) {
    console.error("Error submitting form:", error);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}