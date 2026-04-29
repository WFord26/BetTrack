import React from 'react';
import { formatCurrency, formatPercentage } from '../../utils/format';

interface StatCardProps {
  label: string;
  value: string | number;
  format?: 'currency' | 'percentage' | 'number';
  change?: number;
  icon?: React.ReactNode;
  // outcome: only set when the value has genuine win/loss meaning (P&L, ROI).
  // Omit for neutral stats (count, rate). This is the only color signal in the card.
  outcome?: 'win' | 'loss';
}

const outcomeValueClass: Record<NonNullable<StatCardProps['outcome']>, string> = {
  win:  'text-win-600 dark:text-win-400',
  loss: 'text-loss-600 dark:text-loss-400',
};

function StatCard({ label, value, format = 'number', change, icon, outcome }: StatCardProps) {
  const formattedValue = () => {
    if (value === null || value === undefined) return '0';
    if (format === 'currency') return formatCurrency(Number(value));
    if (format === 'percentage') return formatPercentage(Number(value));
    return value.toString();
  };

  const isPositiveChange = change !== undefined && change > 0;
  const isNegativeChange = change !== undefined && change < 0;

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-display font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 mb-1">
            {label}
          </p>
          {/* Value — semantic color only when outcome is explicitly set */}
          <p className={`text-3xl font-bold ${outcome ? outcomeValueClass[outcome] : 'text-gray-900 dark:text-white'}`}>
            {formattedValue()}
          </p>

          {change !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {isPositiveChange && (
                <svg className="w-4 h-4 text-win-600 dark:text-win-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {isNegativeChange && (
                <svg className="w-4 h-4 text-loss-600 dark:text-loss-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`text-sm font-medium ${
                isPositiveChange ? 'text-win-600 dark:text-win-400'
                : isNegativeChange ? 'text-loss-600 dark:text-loss-400'
                : 'text-gray-500'
              }`}>
                {Math.abs(change).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Icon badge — always neutral. Color is carried by the value, not the decoration. */}
        {icon && (
          <div className="bg-surface-100 dark:bg-surface-700 text-gray-500 dark:text-gray-400 p-3 rounded-lg">
            {icon}
          </div>
        )}
      </div>
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Total Bets"
        value={stats.totalBets}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />

      <StatCard
        label="Win Rate"
        value={stats.winRate}
        format="percentage"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />

      <StatCard
        label="Total P&L"
        value={stats.netProfit}
        format="currency"
        outcome={stats.netProfit >= 0 ? 'win' : 'loss'}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      <StatCard
        label="ROI"
        value={stats.roi}
        format="percentage"
        outcome={stats.roi >= 0 ? 'win' : 'loss'}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />
    </div>
  );
}
