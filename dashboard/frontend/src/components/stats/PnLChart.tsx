import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { formatCurrency, formatDate } from '../../utils/format';

interface PnLDataPoint {
  date: string;
  pnl: number;
  cumulativePnl: number;
}

interface PnLChartProps {
  data: PnLDataPoint[];
}

export default function PnLChart({ data }: PnLChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">P&L Over Time</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  // Determine if overall P&L is positive or negative
  const finalPnL = data[data.length - 1]?.cumulativePnl || 0;
  const isPositive = finalPnL >= 0;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';
  const fillColor = isPositive ? '#10b98120' : '#ef444420';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">P&L Over Time</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            tickFormatter={(value) => `$${value}`}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px'
            }}
            formatter={(value: number) => [formatCurrency(value), 'Cumulative P&L']}
            labelFormatter={(label) => formatDate(label)}
          />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#colorPnl)"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-gray-600">
          {data.length} bets tracked
        </div>
        <div className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          Total: {formatCurrency(finalPnL)}
        </div>
      </div>
    </div>
  );
}
