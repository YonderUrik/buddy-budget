import { NextRequest, NextResponse } from "next/server";

import {
  searchStocks,
  getStockLogo,
} from "@/components/yahoo-finance/functions";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 },
      );
    }

    // Search for stocks using Yahoo Finance API
    const results = await searchStocks(query);

    // Filter out results without a symbol
    const filteredResults = results.filter((result) => result.symbol);

    // Fetch logo URLs for each result (in parallel for better performance)
    const resultsWithLogos = await Promise.all(
      filteredResults.map(async (result) => {
        const logoUrl = await getStockLogo(
          result.symbol,
          result.shortname || "",
          result.quoteType || "",
          result.longname || "",
        );

        return {
          ...result,
          logoUrl,
        };
      }),
    );

    return NextResponse.json({ results: resultsWithLogos });
  } catch (error) {
    console.error("Error searching stocks:", error);

    return NextResponse.json(
      { error: "Failed to search stocks" },
      { status: 500 },
    );
  }
}
