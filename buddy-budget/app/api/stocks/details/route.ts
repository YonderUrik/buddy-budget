import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { getStockDetails } from "@/components/yahoo-finance/functions";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 },
      );
    }

    // Fetch comprehensive stock details with multiple modules
    const details = await getStockDetails(symbol, [
      "assetProfile",
      "price",
      "financialData",
      "defaultKeyStatistics",
      "earnings",
      "calendarEvents",
      // 'recommendationTrend',
      // 'upgradeDowngradeHistory',
      // 'majorHoldersBreakdown',
      "institutionOwnership",
      // 'insiderHolders',
      // 'insiderTransactions',
    ]);

    return NextResponse.json({ details });
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        api_route: "/api/stocks/details",
        method: "GET",
      },
    });
    console.error("Error fetching stock details:", error);

    return NextResponse.json(
      { error: "Failed to fetch stock details" },
      { status: 500 },
    );
  }
}
