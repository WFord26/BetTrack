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
import { chartChrome, chartSeries } from '../theme/chartTokens';
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
      <div className="min-h-screen bg-dusk dark:bg-dusk ds-sand-bg dark:bg-none py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-dusk-panel2 w-1/3"></div>
            <div className="h-64 bg-dusk-panel2"></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="h-64 bg-dusk-panel2"></div>
              <div className="h-64 bg-dusk-panel2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dusk py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="ds-panel p-6">
            <p className="font-display text-[8px] tracking-[.08em] text-coral mb-2">ERROR LOADING CLV ANALYTICS</p>
            <p className="font-body text-sm text-cream-secondary">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!report || !report.summary || report.summary.totalBets === 0) {
    return (
      <div className="min-h-screen bg-dusk py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="ds-panel p-12 text-center">
            <p className="font-display text-[13px] text-cream mb-3">NO CLV DATA AVAILABLE</p>
            <p className="font-body text-sm text-cream-muted max-w-md mx-auto">
              Place bets and let them settle to see CLV analytics. Closing line values are captured automatically before games start.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { summary } = report;

  return (
    <div className="min-h-screen bg-dusk py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-[8px] tracking-[.1em] text-ember mb-2">SIGNAL FROM THE HERD</p>
            <h1 className="font-display text-[19px] text-cream text-shadow-ds-terra">
              CLV ANALYTICS
            </h1>
            <p className="font-body text-sm text-cream-muted mt-1">
              Closing Line Value analysis across {summary.totalBets} bets
            </p>
          </div>
          <button onClick={handleExportCSV} className="ds-btn-press font-display text-[8px] tracking-[.06em] px-4 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            EXPORT CSV
          </button>
        </div>

        {/* Filters */}
        <div className="ds-panel p-5">
          <h3 className="font-display text-[8px] tracking-[.1em] text-cream mb-4">FILTERS</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'PERIOD', field: 'period', options: [{ v: 'week', l: 'Last Week' }, { v: 'month', l: 'Last Month' }, { v: 'season', l: 'This Season' }, { v: 'all-time', l: 'All Time' }], value: localFilters.period || 'all-time', onChange: (v: string) => setLocalFilters({ ...localFilters, period: v as any }) },
              { label: 'SPORT', field: 'sport', options: [{ v: '', l: 'All Sports' }, { v: 'americanfootball_nfl', l: 'NFL' }, { v: 'basketball_nba', l: 'NBA' }, { v: 'basketball_ncaab', l: 'NCAAB' }, { v: 'icehockey_nhl', l: 'NHL' }, { v: 'baseball_mlb', l: 'MLB' }], value: localFilters.sportKey || '', onChange: (v: string) => setLocalFilters({ ...localFilters, sportKey: v || undefined }) },
              { label: 'BET TYPE', field: 'betType', options: [{ v: '', l: 'All Types' }, { v: 'moneyline', l: 'Moneyline' }, { v: 'spread', l: 'Spread' }, { v: 'total', l: 'Total' }, { v: 'player_prop', l: 'Player Props' }], value: localFilters.betType || '', onChange: (v: string) => setLocalFilters({ ...localFilters, betType: v || undefined }) },
            ].map(({ label, field, options, value, onChange }) => (
              <div key={field}>
                <label htmlFor={`clv-filter-${field}`} className="block font-display text-[6px] tracking-[.1em] text-cream-muted mb-1.5">{label}</label>
                <select id={`clv-filter-${field}`} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-dusk-panel2 text-cream font-display text-[7px] tracking-[.06em] px-3 py-2 border-0 focus:outline-none focus:ring-2 focus:ring-gold">
                  {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
            <div className="flex items-end gap-2">
              <button onClick={handleApplyFilters} className="flex-1 ds-btn-press font-display text-[7px] tracking-[.06em] py-2">APPLY</button>
              <button onClick={handleClearFilters} className="px-4 py-2 bg-dusk-panel2 text-cream-muted font-display text-[7px] tracking-[.06em] hover:bg-dusk-panel transition-colors">CLEAR</button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'AVG CLV', value: `${summary.averageCLV > 0 ? '+' : ''}${summary.averageCLV.toFixed(2)}%`, colorClass: summary.averageCLV >= 2 ? 'text-sunwin-dark' : summary.averageCLV <= -2 ? 'text-sunloss-dark' : 'text-gold' },
            { label: 'CLV WIN RATE', value: formatPercentage(summary.clvWinRate), colorClass: 'text-cream' },
            { label: 'EXPECTED ROI', value: `${summary.expectedROI > 0 ? '+' : ''}${summary.expectedROI.toFixed(2)}%`, colorClass: summary.expectedROI >= 0 ? 'text-sunwin-dark' : 'text-sunloss-dark' },
            { label: 'ACTUAL ROI', value: `${summary.actualROI > 0 ? '+' : ''}${summary.actualROI.toFixed(2)}%`, colorClass: summary.actualROI >= 0 ? 'text-sunwin-dark' : 'text-sunloss-dark' },
          ].map(({ label, value, colorClass }) => (
            <div key={label} className="ds-panel px-[18px] py-4">
              <p className="font-display text-[7px] tracking-[.1em] text-cream-muted mb-2">{label}</p>
              <p className={`font-display text-[22px] ${colorClass}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* CLV Trend Chart */}
        <div className="ds-panel p-5">
          <h3 className="font-display text-[9px] tracking-[.08em] text-cream mb-4">CLV TREND · LAST 12 WEEKS</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.grid} />
              <XAxis 
                dataKey="date" 
                stroke={chartChrome.axis}
                tick={{ fill: chartChrome.axis }}
              />
              <YAxis 
                stroke={chartChrome.axis}
                tick={{ fill: chartChrome.axis }}
                label={{ value: 'CLV %', angle: -90, position: 'insideLeft', fill: chartChrome.axis }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: chartChrome.tooltipBg,
                  border: `1px solid ${chartChrome.grid}`,
                  borderRadius: '8px',
                  color: chartChrome.tooltipText
                }}
                formatter={(value: any) => [`${value.toFixed(2)}%`, 'CLV']}
              />
              <Legend wrapperStyle={{ color: chartChrome.axis }} />
              <Line
                type="monotone"
                dataKey="averageCLV"
                stroke={chartSeries.primary}
                strokeWidth={3}
                dot={{ fill: chartSeries.primary, r: 4 }}
                name="Average CLV"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CLV by Sport & Bookmaker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="ds-panel p-5">
            <h3 className="font-display text-[9px] tracking-[.08em] text-cream mb-4">CLV BY SPORT</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.bySport}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.grid} />
                <XAxis 
                  dataKey="sportName" 
                  stroke={chartChrome.axis}
                  tick={{ fill: chartChrome.axis, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke={chartChrome.axis}
                  tick={{ fill: chartChrome.axis }}
                  label={{ value: 'CLV %', angle: -90, position: 'insideLeft', fill: chartChrome.axis }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: chartChrome.tooltipBg,
                    border: `1px solid ${chartChrome.grid}`,
                    borderRadius: '8px',
                    color: chartChrome.tooltipText
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)}%`, 'Avg CLV']}
                />
                <Bar dataKey="averageCLV" fill={chartSeries.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="ds-panel p-5">
            <h3 className="font-display text-[9px] tracking-[.08em] text-cream mb-4">CLV BY BOOKMAKER</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.byBookmaker}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartChrome.grid} />
                <XAxis 
                  dataKey="bookmaker" 
                  stroke={chartChrome.axis}
                  tick={{ fill: chartChrome.axis, fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke={chartChrome.axis}
                  tick={{ fill: chartChrome.axis }}
                  label={{ value: 'CLV %', angle: -90, position: 'insideLeft', fill: chartChrome.axis }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: chartChrome.tooltipBg,
                    border: `1px solid ${chartChrome.grid}`,
                    borderRadius: '8px',
                    color: chartChrome.tooltipText
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)}%`, 'Avg CLV']}
                />
                <Bar dataKey="averageCLV" fill={chartSeries.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top & Worst Bets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="ds-panel p-5">
            <h3 className="font-display text-[8px] tracking-[.08em] text-sunwin-dark mb-4">TOP 3 CLV BETS</h3>
            <div className="flex flex-col gap-3">
              {report.topBets.slice(0, 5).map((bet) => (
                <div key={bet.betId} className="ds-sand-bg shadow-ds-drop px-3 py-3 text-ink">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-body text-sm font-semibold text-ink">{bet.sportName}</span>
                    <span className="font-display text-[11px] text-sunwin-light">+{bet.clv.toFixed(2)}%</span>
                  </div>
                  <p className="font-body text-sm text-ink-muted mb-1">{bet.matchup}</p>
                  <div className="flex items-center justify-between font-display text-[6.5px] tracking-[.06em] text-ink-muted">
                    <span>{bet.selectionType}</span>
                    <span>{bet.odds} → {bet.closingOdds}</span>
                    {bet.outcome && <span className={bet.outcome === 'won' ? 'text-sunwin-light' : bet.outcome === 'lost' ? 'text-sunloss-light' : 'text-sunpending'}>{bet.outcome.toUpperCase()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ds-panel p-5">
            <h3 className="font-display text-[8px] tracking-[.08em] text-coral mb-4">WORST 3 CLV BETS</h3>
            <div className="flex flex-col gap-3">
              {report.worstBets.slice(0, 5).map((bet) => (
                <div key={bet.betId} className="ds-sand-bg shadow-ds-drop px-3 py-3 text-ink">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-body text-sm font-semibold text-ink">{bet.sportName}</span>
                    <span className="font-display text-[11px] text-sunloss-light">{bet.clv.toFixed(2)}%</span>
                  </div>
                  <p className="font-body text-sm text-ink-muted mb-1">{bet.matchup}</p>
                  <div className="flex items-center justify-between font-display text-[6.5px] tracking-[.06em] text-ink-muted">
                    <span>{bet.selectionType}</span>
                    <span>{bet.odds} → {bet.closingOdds}</span>
                    {bet.outcome && <span className={bet.outcome === 'won' ? 'text-sunwin-light' : bet.outcome === 'lost' ? 'text-sunloss-light' : 'text-sunpending'}>{bet.outcome.toUpperCase()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="ds-panel p-5">
          <h3 className="font-display text-[8px] tracking-[.08em] text-gold mb-3">ABOUT CLOSING LINE VALUE</h3>
          <div className="font-body text-sm text-cream-secondary space-y-2">
            <p><strong className="text-cream">Closing Line Value</strong> measures how your betting odds compare to the closing market line (odds just before game start). It's calculated as: <code className="bg-dusk-panel2 text-cream-muted px-1">((Closing Prob - Opening Prob) / Opening Prob) × 100</code></p>
            <p><strong className="text-cream">Why it matters:</strong> Consistently beating the closing line is the #1 indicator of long-term betting profitability.</p>
            <p><strong className="text-cream">Categories:</strong> Positive CLV (≥ +2%) = value betting, Neutral (-2% to +2%) = fair odds, Negative (≤ -2%) = poor value</p>
          </div>
        </div>
      </div>
    </div>
  );
}
