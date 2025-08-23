import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    const { searchParams } = new URL(request.url);
    
    // Parse pagination parameters
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    // Optional filters
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type'); // 'income' or 'expense'
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');

    // Validate pagination parameters
    if (skip < 0 || limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: "Invalid pagination parameters. Skip must be >= 0, limit must be 1-500" }, 
        { status: 400 }
      );
    }

    // Build where clause
    const whereClause: any = { userId };
    
    if (accountId && accountId !== 'all') {
      whereClause.accountId = accountId;
    }
    
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.date.lte = new Date(endDate);
      }
    }
    
    // Filter by transaction type (income/expense/transfer)
    if (type === 'income') {
      whereClause.amount = { gt: 0 };
      whereClause.type = { not: 'transfer' };
    } else if (type === 'expense') {
      whereClause.amount = { lt: 0 };
      whereClause.type = { not: 'transfer' };
    } else if (type === 'transfer') {
      whereClause.type = 'transfer';
    }
    
    // Search filter for merchant name or description
    if (search && search.trim()) {
      const searchTerm = search.trim();
      whereClause.OR = [
        {
          merchantName: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        }
      ];
    }
    
    // Category filter
    if (categoryId && categoryId !== 'all') {
      if (categoryId === 'uncategorized') {
        whereClause.categoryId = null;
      } else {
        whereClause.categoryId = categoryId;
      }
    }

    // Get transactions with pagination
    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          account: {
            select: {
              id: true,
              name: true,
              type: true,
              institutionName: true
            }
          },
          category: true
        }
      }),
      prisma.transaction.count({
        where: whereClause
      })
    ]);

    // Calculate pagination metadata
    const hasMore = skip + limit < totalCount;
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = Math.floor(skip / limit) + 1;

    return NextResponse.json({
      data: transactions,
      pagination: {
        skip,
        limit,
        totalCount,
        hasMore,
        totalPages,
        currentPage
      }
    });

  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" }, 
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    const body = await request.json();
    
    const {
      amount,
      currency,
      accountId,
      description,
      merchantName,
      categoryId,
      date,
      type,
      provider = 'manual'
    } = body;

    // Validate required fields
    if (typeof amount !== 'number' || amount === 0) {
      return NextResponse.json({ error: "Amount is required and must be a non-zero number" }, { status: 400 });
    }
    if (!accountId) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }
    if (!description && !merchantName) {
      return NextResponse.json({ error: "Either description or merchant name is required" }, { status: 400 });
    }

    // Verify the account belongs to the user and is manual
    const account = await prisma.financialAccount.findFirst({
      where: {
        id: accountId,
        userId: userId,
        provider: 'manual'
      }
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found or not a manual account" }, { status: 404 });
    }

    // Verify category belongs to user if provided
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId: userId
        }
      });
      
      if (!category) {
        return NextResponse.json({ error: "Category not found" }, { status: 404 });
      }
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        accountId,
        amount,
        currency: currency || account.currency,
        description: description || null,
        merchantName: merchantName || null,
        categoryId: categoryId || null,
        date: new Date(date),
        type: type || null,
        provider
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            institutionName: true
          }
        },
        category: true
      }
    });

    // Update account balance
    await prisma.financialAccount.update({
      where: { id: accountId },
      data: {
        balance: {
          increment: amount
        }
      }
    });

    return NextResponse.json(transaction, { status: 201 });

  } catch (error) {
    console.error('Failed to create transaction:', error);
    return NextResponse.json(
      { error: "Failed to create transaction" }, 
      { status: 500 }
    );
  }
}