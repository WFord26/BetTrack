import React from 'react';
import { formatCurrency, formatPercentage } from '../../utils/format';

interface StatCardProps {
  label: string;
  value: string | number;
  format?: 'currency' | 'percentage' | 'number';
  // outcome: only set when the value has genuine win/loss meaning (P&L, ROI).
  // Omit for neutral stats (count, rate). This is the only color signal on the value.
  outcome?: 'win' | 'loss';
  note?: string;
  // meter: a genuine 0-1 ratio to render as a 10-block fill meter. Omit for
  // cards with no natural cap (raw dollar totals, uncapped percentages).
  meter?: { ratio: number; color: string };
}

const outcomeValueClass: Record<NonNullable<StatCardProps['outcome']>, string> = {
  win:  'text-sunwin-light',
  loss: 'text-sunloss-light',
};

function StatCard({ label, value, format = 'number', outcome, note, meter }: StatCardProps) {
  const formattedValue = () => {
    if (value === null || value === undefined) return '0';
    if (format === 'currency') return formatCurrency(Number(value));
    if (format === 'percentage') return formatPercentage(Number(value));
    return value.toString();
  };

  const filledBlocks = meter ? Math.round(Math.min(Math.max(meter.ratio, 0), 1) * 10) : 0;

  return (
    <div className="ds-card-ink px-[18px] py-4">
      <p className="font-display text-[7px] text-ink-muted tracking-[.1em] leading-[1.7] uppercase">
        {label}
      </p>
      <p className={`font-display text-[16px] mt-3 ${outcome ? outcomeValueClass[outcome] : 'text-ink'}`}>
        {formattedValue()}
      </p>

      {note && (
        <p className="font-body text-[12px] text-ink-muted mt-2">{note}</p>
      )}

      {meter && (
        <div className="flex gap-[3px] mt-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="w-[10px] h-[10px]"
              style={{ backgroundColor: i < filledBlocks ? meter.color : '#e4d2ae' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface StatsOverviewProps {
  stats: {
    totalBets: number;
    wonBets: number;
    lostBets: number;
    pushBets: number;
    winRate: number;
    totalStaked: number;
    totalReturn: number;
    netProfit: number;
    roi: number;
  };
}

export default function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Bets"
        value={stats.totalBets}
        note={`${stats.wonBets}W-${stats.lostBets}L`}
      />

      <StatCard
        label="Win Rate"
        value={stats.winRate}
        format="percentage"
        meter={{ ratio: stats.winRate / 100, color: '#6d4a9e' }}
      />

      <StatCard
        label="Total P&L"
        value={stats.netProfit}
        format="currency"
        outcome={stats.netProfit >= 0 ? 'win' : 'loss'}
      />

      <StatCard
        label="ROI"
        value={stats.roi}
        format="percentage"
        outcome={stats.roi >= 0 ? 'win' : 'loss'}
      />
    </div>
  );
}
