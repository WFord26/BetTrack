import React from 'react';
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
      <div className="ds-card-ink px-5 py-[18px]">
        <h3 className="font-display text-[9px] text-ink mb-4">P&L OVER TIME</h3>
        <div className="h-[150px] flex items-center justify-center font-body text-sm text-ink-muted">
          No data available
        </div>
      </div>
    );
  }

  // Determine if overall (final cumulative) P&L is positive or negative
  const finalPnL = data[data.length - 1]?.cumulativePnl || 0;
  const isPositive = finalPnL >= 0;

  // Scale bars against the largest magnitude in the real series
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.cumulativePnl)), 1);
  const MAX_BAR_HEIGHT = 110;

  return (
    <div className="ds-card-ink px-5 py-[18px]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display text-[9px] text-ink">P&L OVER TIME</h3>
          <p className="font-body text-[12px] text-ink-muted mt-1">
            Cumulative net P&L across {data.length} tracked day{data.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-[10px] h-[10px] bg-sunwin-light" />
            <span className="font-body text-[12px] text-ink-muted">up day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-[10px] h-[10px] bg-sunloss-light" />
            <span className="font-body text-[12px] text-ink-muted">down day</span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-3.5 h-[150px] border-b-[3px] border-ink px-2">
        {data.map((point, i) => {
          const value = point.cumulativePnl;
          const barHeight = Math.max(Math.round((Math.abs(value) / maxAbs) * MAX_BAR_HEIGHT), 4);
          const positive = value >= 0;
          return (
            <div key={`${point.date}-${i}`} className="flex flex-col items-center justify-end h-full">
              <span className="font-body text-[10.5px] font-semibold text-ink mb-1">
                {formatCurrency(value)}
              </span>
              <div
                className={`w-[26px] shadow-ds-meter-sand ${positive ? 'bg-sunwin-light' : 'bg-sunloss-light'}`}
                style={{ height: `${barHeight}px` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-3.5 px-2 mt-2">
        {data.map((point, i) => (
          <div key={`${point.date}-label-${i}`} className="w-[26px] flex justify-center">
            <span className="font-display text-[6px] text-ink-muted text-center">
              {formatDate(point.date)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between font-body text-sm">
        <div className="text-ink-muted">
          {data.length} data point{data.length === 1 ? '' : 's'} tracked
        </div>
        <div className={`font-semibold ${isPositive ? 'text-sunwin-light' : 'text-sunloss-light'}`}>
          Total: {formatCurrency(finalPnL)}
        </div>
      </div>
    </div>
  );
}
