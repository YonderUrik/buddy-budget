"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@heroui/button";
import { ButtonGroup } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { DatePicker } from "@heroui/date-picker";
import { parseDate } from "@internationalized/date";
import Image from "next/image";

import { HistoricalDataPoint, getStockLogo } from "./functions";

import { formatCurrency, formatPercentage } from "@/utils/format";

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
    window.addEventListener("resize", checkMobile);

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
}

// type ChartType = "area";
type Interval = "1d" | "1wk" | "1mo";
type QuickRange = "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "YTD" | "MAX";

interface StockChartProps {
  symbol: string;
  onSymbolChange?: (symbol: string) => void;
  logoUrl?: string | null;
  longName?: string;
}

// Format date based on interval (for X-axis labels)
const formatDate = (date: Date, interval: Interval): string => {
  const d = new Date(date);

  if (interval === "1d") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else if (interval === "1wk") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
};

// Format date with year (for tooltips)
const formatDateWithYear = (date: Date): string => {
  const d = new Date(date);

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Calculate date range based on quick range
const getDateRangeFromQuickRange = (
  range: QuickRange,
): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case "1M":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3M":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6M":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1Y":
      start.setFullYear(start.getFullYear() - 1);
      break;
    case "2Y":
      start.setFullYear(start.getFullYear() - 2);
      break;
    case "5Y":
      start.setFullYear(start.getFullYear() - 5);
      break;
    case "YTD":
      start.setMonth(0);
      start.setDate(1);
      break;
    case "MAX":
      start.setFullYear(start.getFullYear() - 20);
      break;
  }

  return { start, end };
};

export function StockChart({ symbol, logoUrl: propLogoUrl, longName: propLongName }: StockChartProps) {
  const [interval, setInterval] = useState<Interval>("1d");
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();

    date.setMonth(date.getMonth() - 3);

    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuickRange, setSelectedQuickRange] =
    useState<QuickRange | null>("3M");
  const [currency, setCurrency] = useState<string>("USD");
  const [fetchedLogoUrl, setFetchedLogoUrl] = useState<string | null>(null);
  const [fetchedLongName, setFetchedLongName] = useState<string>("");

  // Use prop values if provided, otherwise use fetched values
  const logoUrl = propLogoUrl !== undefined ? propLogoUrl : fetchedLogoUrl;
  const longName = propLongName !== undefined ? propLongName : fetchedLongName;

  // Debounce the symbol
  const debouncedSymbol = useDebounce(symbol, 300);

  // Check if mobile
  const isMobile = useIsMobile();

  // Fetch currency, logo, and long name from stock details (only if not provided as props)
  useEffect(() => {
    const fetchStockInfo = async () => {
      if (!debouncedSymbol) return;

      try {
        const response = await fetch(
          `/api/stocks/details?symbol=${encodeURIComponent(debouncedSymbol)}`,
        );

        if (response.ok) {
          const result = await response.json();
          const detectedCurrency =
            result.details?.price?.currency ||
            result.details?.summaryDetail?.currency ||
            "USD";

          setCurrency(detectedCurrency);

          // Only fetch long name if not provided as prop
          if (propLongName === undefined) {
            const detectedLongName =
              result.details?.price?.longName ||
              result.details?.price?.shortName ||
              result.details?.quoteType?.longName ||
              "";

            setFetchedLongName(detectedLongName);
          }

          // Only fetch logo if not provided as prop
          if (propLogoUrl === undefined) {
            const shortName = result.details?.price?.shortName || "";
            const quoteType =
              result.details?.quoteType?.quoteType || "EQUITY";

            try {
              const logo = await getStockLogo(
                debouncedSymbol,
                shortName,
                quoteType,
              );

              setFetchedLogoUrl(logo);
            } catch (logoErr) {
              console.error("Error fetching logo:", logoErr);
              setFetchedLogoUrl(null);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching stock info:", err);
        // Keep defaults if error
      }
    };

    fetchStockInfo();
  }, [debouncedSymbol, propLogoUrl, propLongName]);

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
          throw new Error("Failed to fetch historical data");
        }

        const result = await response.json();

        setData(result.data || []);
      } catch (err) {
        console.error("Error fetching historical data:", err);
        setError("Failed to load chart data. Please try again.");
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
    const high = Math.max(...chartData.map((d) => d.high));
    const low = Math.min(...chartData.map((d) => d.low));

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
    <Card className="w-full bg-white dark:bg-black">
      <CardHeader className="flex flex-col gap-3 pb-0 px-3 sm:px-6">
        <div className="flex flex-col gap-2 w-full">
          {/* Logo and Title Row */}
          <div className="flex items-center gap-3">
            {/* Stock Logo */}
            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-default-100 overflow-hidden">
              {logoUrl ? (
                <Image
                  alt={symbol}
                  className="w-10 h-10 object-contain"
                  height={40}
                  src={logoUrl}
                  width={40}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    if (e.currentTarget.nextElementSibling) {
                      (
                        e.currentTarget.nextElementSibling as HTMLElement
                      ).style.display = "flex";
                    }
                  }}
                />
              ) : null}
              <span
                className="text-sm font-bold text-default-600"
                style={{ display: logoUrl ? "none" : "flex" }}
              >
                {symbol.substring(0, 2)}
              </span>
            </div>

            {/* Symbol and Long Name */}
            <div className="flex flex-col">
              <h3 className="text-lg sm:text-xl font-bold">
                {symbol}
                {longName && (
                  <span className="text-sm sm:text-base font-normal text-default-500 ml-2">
                    {longName}
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {statistics && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                  <span className="text-xl sm:text-2xl font-bold">
                    {formatCurrency(statistics.lastPrice, {
                      currency,
                      showCents: true,
                    })}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-semibold ${
                      statistics.priceChange >= 0
                        ? "text-success"
                        : "text-danger"
                    }`}
                  >
                    {statistics.priceChange >= 0 ? "+" : ""}
                    {formatCurrency(Math.abs(statistics.priceChange), {
                      currency,
                      showCents: true,
                    })}{" "}
                    ({statistics.priceChange >= 0 ? "+" : "-"}
                    {formatPercentage(Math.abs(statistics.priceChangePercent), {
                      multiply: true,
                      decimals: 2,
                    })}
                    )
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-xs text-default-500">
                  <span>
                    High:{" "}
                    <span className="font-semibold">
                      {formatCurrency(statistics.high, {
                        currency,
                        showCents: true,
                      })}
                    </span>
                  </span>
                  <span>
                    Low:{" "}
                    <span className="font-semibold">
                      {formatCurrency(statistics.low, {
                        currency,
                        showCents: true,
                      })}
                    </span>
                  </span>
                  <span className="col-span-2 sm:col-span-1">
                    Period:{" "}
                    <span className="font-semibold">
                      {statistics.firstDate} - {statistics.lastDate}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Interval Selector */}
        <div className="w-full overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex gap-2 min-w-max sm:min-w-0">
            <ButtonGroup className="flex-shrink-0" size="sm" variant="flat">
              <Button
                className="min-w-[70px]"
                color={interval === "1d" ? "primary" : "default"}
                onPress={() => setInterval("1d")}
              >
                Daily
              </Button>
              <Button
                className="min-w-[70px]"
                color={interval === "1wk" ? "primary" : "default"}
                onPress={() => setInterval("1wk")}
              >
                Weekly
              </Button>
              <Button
                className="min-w-[70px]"
                color={interval === "1mo" ? "primary" : "default"}
                onPress={() => setInterval("1mo")}
              >
                Monthly
              </Button>
            </ButtonGroup>
          </div>
        </div>

        {/* Quick Range Buttons */}
        <div className="w-full overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex gap-2 min-w-max sm:min-w-0 sm:flex-wrap">
            {(
              ["1M", "3M", "6M", "1Y", "2Y", "5Y", "YTD", "MAX"] as QuickRange[]
            ).map((range) => (
              <Button
                key={range}
                className="min-w-[50px] flex-shrink-0"
                color={selectedQuickRange === range ? "primary" : "default"}
                size="sm"
                variant={selectedQuickRange === range ? "solid" : "bordered"}
                onPress={() => handleQuickRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        {/* Date Range Pickers */}
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <DatePicker
            className="flex-1"
            label="Start Date"
            size="sm"
            value={parseDate(startDate.toISOString().split("T")[0])}
            onChange={(date) => {
              if (date) {
                setStartDate(new Date(date.year, date.month - 1, date.day));
                setSelectedQuickRange(null);
              }
            }}
          />
          <DatePicker
            className="flex-1"
            label="End Date"
            size="sm"
            value={parseDate(endDate.toISOString().split("T")[0])}
            onChange={(date) => {
              if (date) {
                setEndDate(new Date(date.year, date.month - 1, date.day));
                setSelectedQuickRange(null);
              }
            }}
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
          <ResponsiveContainer height={isMobile ? 300 : 400} width="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorClose" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid opacity={0.3} strokeDasharray="3 3" />
              <XAxis
                angle={isMobile ? -45 : 0}
                dataKey="dateStrWithYear"
                height={isMobile ? 60 : 30}
                minTickGap={isMobile ? 50 : 30}
                textAnchor={isMobile ? "end" : "middle"}
                tick={{ fontSize: isMobile ? 10 : 12 }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: isMobile ? 10 : 12 }}
                tickFormatter={(value) => formatCurrency(value, { currency })}
                width={isMobile ? 60 : 80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                activeDot={{ r: isMobile ? 6 : 8 }}
                dataKey="close"
                fill="url(#colorClose)"
                fillOpacity={1}
                stroke="#3b82f6"
                strokeWidth={isMobile ? 1.5 : 2}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}
