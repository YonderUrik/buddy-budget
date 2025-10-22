'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@heroui/button';
import { ButtonGroup } from '@heroui/button';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Spinner } from '@heroui/spinner';
import { Tabs, Tab } from '@heroui/tabs';
import { DatePicker } from '@heroui/date-picker';
import { parseDate } from '@internationalized/date';
import { HistoricalDataPoint, SearchResult } from './functions';
import { formatCurrency, formatPercentage } from '@/utils/format';

// useDebounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// useIsMobile hook
function useIsMobile(breakpoint: number = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // Initial check
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();

    // Add event listener
    window.addEventListener('resize', checkMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, [breakpoint]);

  return isMobile;
}

type ChartType = 'area';
type Interval = '1d' | '1wk' | '1mo';
type QuickRange = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | 'YTD' | 'MAX';

interface StockChartProps {
  symbol: string;
  onSymbolChange?: (symbol: string) => void;
}



// Format date based on interval (for X-axis labels)
const formatDate = (date: Date, interval: Interval): string => {
  const d = new Date(date);
  if (interval === '1d') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (interval === '1wk') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
};

// Format date with year (for tooltips)
const formatDateWithYear = (date: Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};


// Calculate date range based on quick range
const getDateRangeFromQuickRange = (range: QuickRange): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case '1M':
      start.setMonth(start.getMonth() - 1);
      break;
    case '3M':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6M':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1Y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    case '2Y':
      start.setFullYear(start.getFullYear() - 2);
      break;
    case '5Y':
      start.setFullYear(start.getFullYear() - 5);
      break;
    case 'YTD':
      start.setMonth(0);
      start.setDate(1);
      break;
    case 'MAX':
      start.setFullYear(start.getFullYear() - 20);
      break;
  }

  return { start, end };
};

export function StockChart({ symbol, onSymbolChange }: StockChartProps) {
  const [interval, setInterval] = useState<Interval>('1d');
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuickRange, setSelectedQuickRange] = useState<QuickRange | null>('3M');
  const [currency, setCurrency] = useState<string>('USD');

  // Debounce the symbol
  const debouncedSymbol = useDebounce(symbol, 300);

  // Check if mobile
  const isMobile = useIsMobile();

  // Fetch currency from stock details
  useEffect(() => {
    const fetchCurrency = async () => {
      if (!debouncedSymbol) return;

      try {
        const response = await fetch(`/api/stocks/details?symbol=${encodeURIComponent(debouncedSymbol)}`);
        if (response.ok) {
          const result = await response.json();
          const detectedCurrency = result.details?.price?.currency || result.details?.summaryDetail?.currency || 'USD';
          setCurrency(detectedCurrency);
        }
      } catch (err) {
        console.error('Error fetching currency:', err);
        // Keep default USD if error
      }
    };

    fetchCurrency();
  }, [debouncedSymbol]);

  // Fetch data when parameters change
  useEffect(() => {
    const fetchData = async () => {
      if (!debouncedSymbol) {
        setData([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          symbol: debouncedSymbol,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          interval,
        });

        const response = await fetch(`/api/stocks/historical?${params}`);

        if (!response.ok) {
          throw new Error('Failed to fetch historical data');
        }

        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        console.error('Error fetching historical data:', err);
        setError('Failed to load chart data. Please try again.');
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [debouncedSymbol, startDate, endDate, interval]);

  // Handle quick range selection
  const handleQuickRange = (range: QuickRange) => {
    const { start, end } = getDateRangeFromQuickRange(range);
    setStartDate(start);
    setEndDate(end);
    setSelectedQuickRange(range);
  };

  // Transform data for charts
  const chartData = useMemo(() => {
    return data.map((point) => ({
      date: new Date(point.date).getTime(),
      dateStr: formatDate(new Date(point.date), interval),
      dateStrWithYear: formatDateWithYear(new Date(point.date)),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
    }));
  }, [data, interval]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (chartData.length === 0) return null;

    const firstPoint = chartData[0];
    const lastPoint = chartData[chartData.length - 1];
    const firstPrice = firstPoint.close;
    const lastPrice = lastPoint.close;
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;

    // Find high and low in the period
    const high = Math.max(...chartData.map(d => d.high));
    const low = Math.min(...chartData.map(d => d.low));

    return {
      firstPrice,
      lastPrice,
      priceChange,
      priceChangePercent,
      high,
      low,
      firstDate: firstPoint.dateStr,
      lastDate: lastPoint.dateStr,
    };
  }, [chartData]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card className="p-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{data.dateStrWithYear}</p>
            <p className="text-xs">
              Price: {formatCurrency(data.close, { currency, showCents: true })}
            </p>
            <p className="text-xs text-default-400">
              Volume: {data.volume.toLocaleString()}
            </p>
          </div>
        </Card>
      );
    }
    return null;
  };

  return (
    <Card className="w-full bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 dark:from-blue-950/20 dark:via-default-100/10 dark:to-purple-950/20">
      <CardHeader className="flex flex-col gap-3 pb-0 px-3 sm:px-6">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg sm:text-xl font-bold">{symbol}</h3>
            {statistics && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                  <span className="text-xl sm:text-2xl font-bold">
                    {formatCurrency(statistics.lastPrice, { currency, showCents: true })}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-semibold ${statistics.priceChange >= 0 ? 'text-success' : 'text-danger'
                      }`}
                  >
                    {statistics.priceChange >= 0 ? '+' : ''}
                    {formatCurrency(Math.abs(statistics.priceChange), { currency, showCents: true })}
                    {' '}
                    ({statistics.priceChange >= 0 ? '+' : '-'}
                    {formatPercentage(Math.abs(statistics.priceChangePercent), { multiply: true, decimals: 2 })})
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs text-default-500">
                  <span>
                    High: <span className="font-semibold">{formatCurrency(statistics.high, { currency, showCents: true })}</span>
                  </span>
                  <span>
                    Low: <span className="font-semibold">{formatCurrency(statistics.low, { currency, showCents: true })}</span>
                  </span>
                  <span className="col-span-2 sm:col-span-1">
                    Period: <span className="font-semibold">{statistics.firstDate} - {statistics.lastDate}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Interval Selector */}
        <div className="w-full overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex gap-2 min-w-max sm:min-w-0">
            <ButtonGroup size="sm" variant="flat" className="flex-shrink-0">
              <Button
                onPress={() => setInterval('1d')}
                color={interval === '1d' ? 'primary' : 'default'}
                className="min-w-[70px]"
              >
                Daily
              </Button>
              <Button
                onPress={() => setInterval('1wk')}
                color={interval === '1wk' ? 'primary' : 'default'}
                className="min-w-[70px]"
              >
                Weekly
              </Button>
              <Button
                onPress={() => setInterval('1mo')}
                color={interval === '1mo' ? 'primary' : 'default'}
                className="min-w-[70px]"
              >
                Monthly
              </Button>
            </ButtonGroup>
          </div>
        </div>

        {/* Quick Range Buttons */}
        <div className="w-full overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex gap-2 min-w-max sm:min-w-0 sm:flex-wrap">
            {(['1M', '3M', '6M', '1Y', '2Y', '5Y', 'YTD', 'MAX'] as QuickRange[]).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={selectedQuickRange === range ? 'solid' : 'bordered'}
                color={selectedQuickRange === range ? 'primary' : 'default'}
                onPress={() => handleQuickRange(range)}
                className="min-w-[50px] flex-shrink-0"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        {/* Date Range Pickers */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <DatePicker
            label="Start Date"
            value={parseDate(startDate.toISOString().split('T')[0])}
            onChange={(date) => {
              if (date) {
                setStartDate(new Date(date.year, date.month - 1, date.day));
                setSelectedQuickRange(null);
              }
            }}
            size="sm"
            className="flex-1"
          />
          <DatePicker
            label="End Date"
            value={parseDate(endDate.toISOString().split('T')[0])}
            onChange={(date) => {
              if (date) {
                setEndDate(new Date(date.year, date.month - 1, date.day));
                setSelectedQuickRange(null);
              }
            }}
            size="sm"
            className="flex-1"
          />
        </div>
      </CardHeader>

      <CardBody className="px-1 sm:px-6 pt-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-64 sm:h-96">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64 sm:h-96">
            <p className="text-danger text-sm text-center px-4">{error}</p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex justify-center items-center h-64 sm:h-96">
            <p className="text-default-400 text-sm">No data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="dateStrWithYear"
                tick={{ fontSize: isMobile ? 10 : 12 }}
                minTickGap={isMobile ? 50 : 30}
                angle={isMobile ? -45 : 0}
                textAnchor={isMobile ? 'end' : 'middle'}
                height={isMobile ? 60 : 30}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: isMobile ? 10 : 12 }}
                tickFormatter={(value) => formatCurrency(value, { currency })}
                width={isMobile ? 60 : 80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#3b82f6"
                strokeWidth={isMobile ? 1.5 : 2}
                fillOpacity={1}
                fill="url(#colorClose)"
                activeDot={{ r: isMobile ? 6 : 8 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
