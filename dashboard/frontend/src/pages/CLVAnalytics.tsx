/**
 * CLV Analytics Page - Comprehensive Closing Line Value analytics and reporting
 * Displays trends, sport/bookmaker breakdowns, and detailed bet analysis
 */
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import {
  fetchCLVReport,
  fetchCLVTrends,
  setFilters,
  clearFilters,
  selectCLVReport,
  selectCLVTrends,
  selectCLVFilters,
  selectCLVLoading,
  selectCLVError
} from '../store/clvSlice';
import { CLVFilters } from '../types/clv.types';
import { formatPercentage, formatCurrency } from '../utils/format';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function CLVAnalytics() {
  const dispatch = useDispatch<AppDispatch>();
  const report = useSelector(selectCLVReport);
  const trends = useSelector(selectCLVTrends);
  const filters = useSelector(selectCLVFilters);
  const loading = useSelector(selectCLVLoading);
  const error = useSelector(selectCLVError);

  const [localFilters, setLocalFilters] = useState<CLVFilters>(filters);

  useEffect(() => {
    dispatch(fetchCLVReport(filters));
    dispatch(fetchCLVTrends(filters));
  }, [dispatch, filters]);

  const handleApplyFilters = () => {
    dispatch(setFilters(localFilters));
  };

  const handleClearFilters = () => {
    setLocalFilters({ period: 'all-time' });
    dispatch(clearFilters());
  };

  const handleExportCSV = () => {
    if (!report) return;

    // Generate CSV content
    let csv = 'Bet ID,Sport,Matchup,Selection,Odds,Closing Odds,CLV %,Category,Outcome,Date\n';
    
    [...report.topBets, ...report.worstBets].forEach(bet => {
      csv += `${bet.betId},${bet.sportName},"${bet.matchup}",${bet.selectionType},${bet.odds},${bet.closingOdds},${bet.clv},${bet.clvCategory},${bet.outcome || 'pending'},${bet.createdAt}\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clv-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && !report) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-semibold">Error Loading CLV Analytics</h3>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!report || report.summary.totalBets === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No CLV Data Available</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Place bets and let them settle to see CLV analytics. Closing line values are captured automatically before games start.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { summary } = report;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CLV Analytics</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Closing Line Value analysis across {summary.totalBets} bets
            </p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Period
              </label>
              <select
                value={localFilters.period || 'all-time'}
                onChange={(e) => setLocalFilters({ ...localFilters, period: e.target.value as any })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="season">This Season</option>
                <option value="all-time">All Time</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sport
              </label>
              <select
                value={localFilters.sportKey || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, sportKey: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="">All Sports</option>
                <option value="americanfootball_nfl">NFL</option>
                <option value="basketball_nba">NBA</option>
                <option value="basketball_ncaab">NCAAB</option>
                <option value="icehockey_nhl">NHL</option>
                <option value="baseball_mlb">MLB</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bet Type
              </label>
              <select
                value={localFilters.betType || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, betType: e.target.value || undefined })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="moneyline">Moneyline</option>
                <option value="spread">Spread</option>
                <option value="total">Total</option>
                <option value="player_prop">Player Props</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Apply
              </button>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average CLV</p>
            <p className={`text-3xl font-bold ${summary.averageCLV >= 2 ? 'text-green-600 dark:text-green-400' : summary.averageCLV <= -2 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
              {summary.averageCLV > 0 ? '+' : ''}{summary.averageCLV.toFixed(2)}%
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">CLV Win Rate</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {formatPercentage(summary.clvWinRate)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Expected ROI</p>
            <p className={`text-3xl font-bold ${summary.expectedROI >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {summary.expectedROI > 0 ? '+' : ''}{summary.expectedROI.toFixed(2)}%
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Actual ROI</p>
            <p className={`text-3xl font-bold ${summary.actualROI >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {summary.actualROI > 0 ? '+' : ''}{summary.actualROI.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* CLV Trend Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">CLV Trend Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                label={{ value: 'CLV %', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6'
                }}
                formatter={(value: any) => [`${value.toFixed(2)}%`, 'CLV']}
              />
              <Legend wrapperStyle={{ color: '#9CA3AF' }} />
              <Line 
                type="monotone" 
                dataKey="averageCLV" 
                stroke="#8B5CF6" 
                strokeWidth={3}
                dot={{ fill: '#8B5CF6', r: 4 }}
                name="Average CLV"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CLV by Sport & Bookmaker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Sport */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">CLV by Sport</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.bySport}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="sportName" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  label={{ value: 'CLV %', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)}%`, 'Avg CLV']}
                />
                <Bar dataKey="averageCLV" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By Bookmaker */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">CLV by Bookmaker</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.byBookmaker}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="bookmaker" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                  label={{ value: 'CLV %', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F3F4F6'
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)}%`, 'Avg CLV']}
                />
                <Bar dataKey="averageCLV" fill="#10B981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top & Worst Bets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Bets */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              Top 5 CLV Bets
            </h3>
            <div className="space-y-3">
              {report.topBets.slice(0, 5).map((bet) => (
                <div key={bet.betId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{bet.sportName}</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      +{bet.clv.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{bet.matchup}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                    <span>{bet.selectionType}</span>
                    <span>{bet.odds} → {bet.closingOdds}</span>
                    {bet.outcome && (
                      <span className={`font-medium ${bet.outcome === 'won' ? 'text-green-600' : bet.outcome === 'lost' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {bet.outcome.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Worst Bets */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
              </svg>
              Worst 5 CLV Bets
            </h3>
            <div className="space-y-3">
              {report.worstBets.slice(0, 5).map((bet) => (
                <div key={bet.betId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{bet.sportName}</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">
                      {bet.clv.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{bet.matchup}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                    <span>{bet.selectionType}</span>
                    <span>{bet.odds} → {bet.closingOdds}</span>
                    {bet.outcome && (
                      <span className={`font-medium ${bet.outcome === 'won' ? 'text-green-600' : bet.outcome === 'lost' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {bet.outcome.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            About Closing Line Value (CLV)
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
            <p>
              <strong>Closing Line Value</strong> measures how your betting odds compare to the closing market line (odds just before game start).
              It's calculated as: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">((Closing Prob - Opening Prob) / Opening Prob) × 100</code>
            </p>
            <p>
              <strong>Why it matters:</strong> Consistently beating the closing line is the #1 indicator of long-term betting profitability.
              Sharp bettors and betting syndicates move lines, so closing lines represent the market's most accurate assessment of true probabilities.
            </p>
            <p>
              <strong>Categories:</strong> Positive CLV (≥ +2%) = value betting, Neutral CLV (-2% to +2%) = fair odds, Negative CLV (≤ -2%) = poor value
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
