"use client";

import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

interface ChartDataPoint {
  date: string;
  balance: number;
}

interface AccountLineChartProps {
  data: ChartDataPoint[];
  currency: string;
  color?: string;
  height?: number;
}

export function AccountLineChart({ 
  data, 
  currency, 
  color = "#3b82f6", 
  height = 60 
}: AccountLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-default-400 text-xs"
        style={{ height }}
      >
        No data
      </div>
    );
  }

  // Sample every 3rd point to reduce visual clutter for 90 days
  const sampledData = data.filter((_, index) => index % 3 === 0 || index === data.length - 1);

  const formatTooltip = (value: number) => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    
    try {
      // Parse the date string (YYYY-MM-DD format)
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return dateStr;
    }
  };

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sampledData}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-background/20 backdrop-blur-md px-2 py-1 rounded-md shadow-sm border border-white/10">
                    <p className="text-xs text-foreground/80">
                      {formatDate(payload[0].payload.date)}
                    </p>
                    <p className="text-xs font-medium text-foreground">
                      {formatTooltip(payload[0].value as number)}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}