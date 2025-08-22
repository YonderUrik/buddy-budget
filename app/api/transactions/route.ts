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

    // Validate pagination parameters
    if (skip < 0 || limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: "Invalid pagination parameters. Skip must be >= 0, limit must be 1-500" }, 
        { status: 400 }
      );
    }

    // Build where clause
    const whereClause: any = { userId };
    
    if (accountId) {
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
    
    // Filter by transaction type (income/expense)
    if (type === 'income') {
      whereClause.amount = { gt: 0 };
    } else if (type === 'expense') {
      whereClause.amount = { lt: 0 };
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