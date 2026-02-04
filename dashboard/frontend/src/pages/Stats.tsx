import React, { useState, useEffect } from 'react';
import StatsOverview from '../components/stats/StatsOverview';
import PnLChart from '../components/stats/PnLChart';
import CLVSummaryCard from '../components/stats/CLVSummaryCard';
import { BetStats } from '../types/game.types';
import api from '../services/api';
import { formatCurrency, formatPercentage, getSportDisplayName } from '../utils/format';

interface SportBreakdown {
  sport: string;
  bets: number;
  won: number;
  lost: number;
  winRate: number;
  pnl: number;
}

interface BetTypeBreakdown {
  betType: string;
  bets: number;
  won: number;
  lost: number;
  winRate: number;
  pnl: number;
}

export default function Stats() {
  const [stats, setStats] = useState<BetStats | null>(null);
  const [pnlData, setPnlData] = useState<any[]>([]);
  const [sportBreakdown, setSportBreakdown] = useState<SportBreakdown[]>([]);
  const [betTypeBreakdown, setBetTypeBreakdown] = useState<BetTypeBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range filter
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Fetch stats
  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {};

      // Calculate date range
      if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        params.startDate = startDate.toISOString();
      }

      const response = await api.get('/bets/stats', { params });
      const apiStats = response.data.data; // Access nested data from {status, data} response
      setStats(apiStats);

      // Map sport breakdown from API response
      const sportStats = Object.entries(apiStats.bySport || {}).map(([sport, data]: [string, any]) => {
        const settledBets = data.won + (data.count - data.won);
        const lost = data.count - data.won;
        const winRate = settledBets > 0 ? (data.won / settledBets) * 100 : 0;
        
        return {
          sport,
          bets: data.count,
          won: data.won,
          lost,
          winRate: Math.round(winRate * 10) / 10,
          pnl: Math.round(data.netProfit * 100) / 100
        };
      });
      setSportBreakdown(sportStats);

      // Map bet type breakdown from API response
      const betTypeStats = Object.entries(apiStats.byBetType || {}).map(([betType, data]: [string, any]) => {
        const settledBets = data.won + (data.count - data.won);
        const lost = data.count - data.won;
        const winRate = settledBets > 0 ? (data.won / settledBets) * 100 : 0;
        
        return {
          betType,
          bets: data.count,
          won: data.won,
          lost,
          winRate: Math.round(winRate * 10) / 10,
          pnl: Math.round(data.netProfit * 100) / 100
        };
      });
      setBetTypeBreakdown(betTypeStats);

      // For P&L chart, we'd need daily bet history
      // For now, generate from available data (simplified)
      // TODO: Add daily P&L tracking in backend
      setPnlData([
        { date: new Date().toISOString().split('T')[0], pnl: apiStats.netProfit, cumulativePnl: apiStats.netProfit }
      ]);
      
      setError(null);
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.response?.data?.message || 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6 h-32 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 mb-4">{error || 'Failed to load statistics'}</p>
            <button
              onClick={fetchStats}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Statistics</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Analyze your betting performance
            </p>
          </div>

          {/* Date Range Filter */}
          <div className="flex gap-2">
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`
                  px-4 py-2 rounded-lg font-medium text-sm transition-all
                  ${
                    dateRange === range
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
                  }
                `}
              >
                {range === 'all' ? 'All Time' : range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="mb-8">
          <StatsOverview stats={stats} />
        </div>

        {/* P&L Chart */}
        <div className="mb-8">
          <PnLChart data={pnlData} />
        </div>

        {/* CLV Summary Card */}
        <div className="mb-8">
          <CLVSummaryCard />
        </div>

        {/* Breakdown Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Sport */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">By Sport</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 font-medium">Sport</th>
                    <th className="pb-2 font-medium text-center">Bets</th>
                    <th className="pb-2 font-medium text-center">Win Rate</th>
                    <th className="pb-2 font-medium text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sportBreakdown.map((row) => (
                    <tr key={row.sport}>
                      <td className="py-3 font-medium text-gray-900 dark:text-white">
                        {getSportDisplayName(row.sport)}
                      </td>
                      <td className="py-3 text-center text-gray-700 dark:text-gray-300">
                        {row.bets}
                      </td>
                      <td className="py-3 text-center text-gray-700 dark:text-gray-300">
                        {formatPercentage(row.winRate)}
                      </td>
                      <td className={`py-3 text-right font-semibold ${row.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Bet Type */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">By Bet Type</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium text-center">Bets</th>
                    <th className="pb-2 font-medium text-center">Win Rate</th>
                    <th className="pb-2 font-medium text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {betTypeBreakdown.map((row) => (
                    <tr key={row.betType}>
                      <td className="py-3 font-medium text-gray-900 dark:text-white capitalize">
                        {row.betType}
                      </td>
                      <td className="py-3 text-center text-gray-700 dark:text-gray-300">
                        {row.bets}
                      </td>
                      <td className="py-3 text-center text-gray-700 dark:text-gray-300">
                        {formatPercentage(row.winRate)}
                      </td>
                      <td className={`py-3 text-right font-semibold ${row.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
