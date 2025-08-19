import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const allowedTypes = new Set(["CASH", "CHECKING", "SAVINGS", "CREDIT_CARD", "INVESTMENT"]);

// Helper function to get date key in local timezone
const getDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to create date range
const createDateRange = (start: Date, end: Date): string[] => {
  const dates: string[] = [];
  const currentDate = new Date(start);

  while (currentDate <= end) {
    dates.push(getDateKey(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

export async function GET() {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const userId = (session.user as any).id;

    // Calculate date range for last 90 days
    const nowDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const accounts = await (prisma as any).financialAccount.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: "desc" },
      include: {
        transactions: {
          where: {
            date: {
              gte: startDate,
            }
          },
          select: {
            amount: true,
            date: true
          },
          orderBy: {
            date: "asc"
          }
        }
      }
    });

    // Process accounts to include chart data
    const accountsWithChartData = accounts.map((account: any) => {

      /// Create a map to store daily transaction totals
      const dailyTransactions = new Map<string, number>();


      // Initialize all days in the range with 0 values
      const dateRange = createDateRange(new Date(startDate), new Date(nowDate));
      dateRange.forEach(dateKey => {
        dailyTransactions.set(dateKey, 0);
      });

      // Aggregate transactions by day
      if (account.transactions && Array.isArray(account.transactions)) {
        account.transactions.forEach((transaction: any) => {
          if (!transaction.date || typeof transaction.amount !== 'number') {
            console.warn('Invalid transaction:', transaction);
            return;
          }

          const transactionDate = new Date(transaction.date);
          const dateKey = getDateKey(transactionDate);

          // Only include transactions within our date range
          if (dailyTransactions.has(dateKey)) {
            const existing = dailyTransactions.get(dateKey) || 0;
            dailyTransactions.set(dateKey, existing + transaction.amount);
          }
        });
      }

      // Convert to sorted array
      const sortedDailyData = Array.from(dailyTransactions.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));


      // Calculate running balance working backwards from current balance
      const chartData: any[] = [];
      let runningBalance = account.balance || 0;

      // Work backwards from the most recent date
      for (let i = sortedDailyData.length - 1; i >= 0; i--) {
        const day = sortedDailyData[i];

        // Record the balance at the end of this day
        chartData.unshift({
          date: day.date,
          balance: Math.round(runningBalance * 100) / 100
        });

        // Calculate the previous day's ending balance
        // If we have $100 today and received $30 today, yesterday we had $70
        // If we have $100 today and spent $30 today, yesterday we had $130
        runningBalance -= day.amount;
      }

      // Add a data point at the beginning with the calculated starting balance
      // This helps show the balance before any transactions in the period
      if (chartData.length > 0 && sortedDailyData.length > 0) {
        const firstDate = new Date(chartData[0].date);
        firstDate.setDate(firstDate.getDate() - 1);
        const startingDateKey = getDateKey(firstDate);

        // Only add if it's within or after our chart start date
        if (firstDate >= startDate) {
          chartData.unshift({
            date: startingDateKey,
            balance: Math.round(runningBalance * 100) / 100
          });
        }
      }

      return {
        ...account,
        transactions: undefined, // Remove transactions to reduce payload
        chartData
      };

    });

    return NextResponse.json(accountsWithChartData);
  } catch (_e) {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const body = await request.json().catch(() => ({}));
  const { name, type, currency, balance, institutionName, icon, color } = body ?? {};

  if (!name || !type || !currency) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
  }
  const initialBalance = typeof balance === "number" ? balance : 0;
  try {
    const created = await (prisma as any).financialAccount.create({
      data: {
        userId,
        name,
        type: type as any,
        currency,
        balance: initialBalance,
        institutionName: institutionName || null,
        icon: icon || null,
        color: color || null,
        provider: "manual",
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (_e) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}


