import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalData } from '@/components/yahoo-finance/functions';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const interval = searchParams.get('interval') as '1d' | '1wk' | '1mo' | null;

    // Validate required parameters
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { error: 'Start date is required' },
        { status: 400 }
      );
    }

    // Parse dates
    const period1 = new Date(startDate);
    const period2 = endDate ? new Date(endDate) : new Date();

    // Validate dates
    if (isNaN(period1.getTime())) {
      return NextResponse.json(
        { error: 'Invalid start date' },
        { status: 400 }
      );
    }

    if (isNaN(period2.getTime())) {
      return NextResponse.json(
        { error: 'Invalid end date' },
        { status: 400 }
      );
    }

    // Fetch historical data
    const data = await getHistoricalData(
      symbol,
      period1,
      period2,
      interval || '1d'
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical data' },
      { status: 500 }
    );
  }
}
