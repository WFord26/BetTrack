import React, { useState, useEffect } from 'react';
import StatsOverview from '../components/stats/StatsOverview';
import PnLChart from '../components/stats/PnLChart';
import CLVSummaryCard from '../components/stats/CLVSummaryCard';
import { BetStats } from '../types/game.types';
import api from '../services/api';
import { formatCurrency, formatPercentage, getSportDisplayName } from '../utils/format';
import { logger } from '../utils/logger';

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
      logger.error('Error fetching stats:', err);
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
      <div className="ds-sand-bg dark:bg-dusk dark:[background-image:none] min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-6 w-48 bg-sand-divider animate-pulse mb-8"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ds-card-ink px-[18px] py-4 h-32 animate-pulse">
                <div className="h-3 bg-sand-divider w-1/2 mb-4"></div>
                <div className="h-6 bg-sand-divider w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="ds-sand-bg dark:bg-dusk dark:[background-image:none] min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="ds-card-ink px-6 py-6 text-center border-sunloss-light">
            <p className="font-body text-ink mb-4">{error || 'Failed to load statistics'}</p>
            <button
              onClick={fetchStats}
              className="ds-btn-press-light px-6 py-2.5 text-[10px]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ds-sand-bg dark:bg-dusk dark:[background-image:none] min-h-screen py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-display text-[8px] text-terra tracking-[.1em] mb-3">HOW'S THE HERD?</p>
            <h1 className="font-display text-[19px] text-ink ds-headline">STATISTICS</h1>
            <p className="mt-3 font-body text-ink-secondary">
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
                  font-display text-[7.5px] px-[13px] py-2.5 border-2 border-ink transition-all
                  ${
                    dateRange === range
                      ? 'bg-terra text-terra-text shadow-ds-press-ink'
                      : 'bg-sand-panel text-ink-secondary'
                  }
                `}
              >
                {range === 'all' ? 'ALL' : range.toUpperCase()}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* By Sport */}
          <div className="ds-card-ink px-5 py-[18px]">
            <h3 className="font-display text-[9px] text-ink mb-3.5">BY SPORT</h3>
            <div className="overflow-x-auto tabular-nums">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b-2 border-ink">
                    <th className="px-1.5 py-2 font-display text-[6.5px] text-ink-muted tracking-[.05em] uppercase">Sport</th>
                    <th className="px-1.5 py-2 font-display text-[6.5px] text-ink-muted tracking-[.05em] uppercase text-center">Bets</th>
                    <th className="px-1.5 py-2 font-display text-[6.5px] text-ink-muted tracking-[.05em] uppercase text-center">Win%</th>
                    <th className="px-1.5 py-2 font-display text-[6.5px] text-ink-muted tracking-[.05em] uppercase text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {sportBreakdown.map((row) => (
                    <tr key={row.sport} className="border-b-2 border-sand-divider">
                      <td className="px-1.5 py-2.5 font-body text-[14px] font-semibold text-ink">
                        {getSportDisplayName(row.sport)}
                      </td>
                      <td className="px-1.5 py-2.5 font-body text-[14px] text-ink-secondary text-center">
                        {row.bets}
                      </td>
                      <td className="px-1.5 py-2.5 font-body text-[14px] text-ink-secondary text-center">
                        {formatPercentage(row.winRate)}
                      </td>
                      <td className={`px-1.5 py-2.5 font-body text-[14px] font-bold text-right ${row.pnl >= 0 ? 'text-sunwin-light' : 'text-sunloss-light'}`}>
                        {formatCurrency(row.pnl)}
                      </td>
                    </tr>
                  ))}
                  {sportBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-1.5 py-4 font-body text-sm text-ink-muted text-center">
                        No sport data for this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Bet Type */}
          <div className="ds-card-ink px-5 py-[18px]">
            <h3 className="font-display text-[9px] text-ink mb-3.5">BY BET TYPE</h3>
            <div className="overflow-x-auto tabular-nums">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b-2 border-ink">
                    <th className="px-1.5 py-2 font-display text-[6.5px] text-ink-muted tracking-[.05em] uppercase">Type</th>
                    <th className="px-1.5 py-2 font-display text-[6.5px] text-ink-muted tracking-[.05em] uppercase text-center">Bets</th>
                    <th className="px-1.5 py-2 font-display text-[6.5px] text-ink-muted tracking-[.05em] uppercase text-center">Win%</th>
                    <th className="px-1.5 py-2 font-display text-[6.5px] text-ink-muted tracking-[.05em] uppercase text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {betTypeBreakdown.map((row) => (
                    <tr key={row.betType} className="border-b-2 border-sand-divider">
                      <td className="px-1.5 py-2.5 font-body text-[14px] font-semibold text-ink capitalize">
                        {row.betType}
                      </td>
                      <td className="px-1.5 py-2.5 font-body text-[14px] text-ink-secondary text-center">
                        {row.bets}
                      </td>
                      <td className="px-1.5 py-2.5 font-body text-[14px] text-ink-secondary text-center">
                        {formatPercentage(row.winRate)}
                      </td>
                      <td className={`px-1.5 py-2.5 font-body text-[14px] font-bold text-right ${row.pnl >= 0 ? 'text-sunwin-light' : 'text-sunloss-light'}`}>
                        {formatCurrency(row.pnl)}
                      </td>
                    </tr>
                  ))}
                  {betTypeBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-1.5 py-4 font-body text-sm text-ink-muted text-center">
                        No bet type data for this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
