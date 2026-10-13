'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  label: string;
  count: number;
}

interface AttendanceChartProps {
  data: ChartDataPoint[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; payload: ChartDataPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs text-muted-foreground">{point.payload.label}</p>
      <p className="text-sm font-semibold mt-0.5">
        {point.value} clock-in{point.value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export function AttendanceChart({ data }: AttendanceChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-chart-1)"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="var(--color-chart-1)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
            tickFormatter={(value: string) => {
              // Show only day abbreviation on smaller viewports
              const parts = value.split(' ');
              return parts[0] ?? value;
            }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="var(--color-chart-1)"
            strokeWidth={2}
            fill="url(#chartGradient)"
            dot={false}
            activeDot={{
              r: 5,
              stroke: 'var(--color-chart-1)',
              strokeWidth: 2,
              fill: 'var(--color-background)',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
