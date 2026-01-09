import React from 'react';
import { formatCurrency, formatPercentage } from '../../utils/format';

interface StatCardProps {
  label: string;
  value: string | number;
  format?: 'currency' | 'percentage' | 'number';
  change?: number;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

function StatCard({ label, value, format = 'number', change, icon, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600'
  };

  const formattedValue = () => {
    if (value === null || value === undefined) {
      return '0';
    }
    if (format === 'currency') {
      return formatCurrency(Number(value));
    }
    if (format === 'percentage') {
      return formatPercentage(Number(value));
    }
    return value.toString();
  };

  const isPositiveChange = change !== undefined && change > 0;
  const isNegativeChange = change !== undefined && change < 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{formattedValue()}</p>
          
          {change !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {isPositiveChange && (
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {isNegativeChange && (
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`text-sm font-medium ${isPositiveChange ? 'text-green-600' : isNegativeChange ? 'text-red-600' : 'text-gray-500'}`}>
                {Math.abs(change).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {icon && (
          <div className={`bg-gradient-to-br ${colorClasses[color]} p-3 rounded-lg text-white`}>
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
  const profitColor = stats.netProfit >= 0 ? 'green' : 'red';
  const roiColor = stats.roi >= 0 ? 'green' : 'red';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Total Bets"
        value={stats.totalBets}
        color="blue"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />

      <StatCard
        label="Win Rate"
        value={stats.winRate}
        format="percentage"
        color="purple"
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
      />

      <StatCard
        label="Total P&L"
        value={stats.netProfit}
        format="currency"
        color={profitColor}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />

      <StatCard
        label="ROI"
        value={stats.roi}
        format="percentage"
        color={roiColor}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        }
      />
    </div>
  );
}
