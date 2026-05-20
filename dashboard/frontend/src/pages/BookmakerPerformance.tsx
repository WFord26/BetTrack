/**
 * Bookmaker Performance Analytics Page
 * Compare and rank bookmakers by value, sharpness, reliability, and market coverage
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import {
  fetchRankings,
  fetchBookmakerDetail,
  fetchOutlierStats,
  clearSelectedBookmaker,
  selectRankings,
  selectSelectedBookmaker,
  selectOutlierStats,
  selectBookmakerLoading,
  selectBookmakerDetailLoading,
  selectBookmakerOutlierLoading,
  selectBookmakerError,
} from '../store/bookmakerSlice';
import { useDarkMode } from '../contexts/DarkModeContext';
import { BookmakerAnalytics, BookmakerRankingCriteria, LimitProfile } from '../types/bookmaker.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBookmakerName(key: string): string {
  const displayNames: Record<string, string> = {
    draftkings: 'DraftKings',
    fanduel: 'FanDuel',
    betmgm: 'BetMGM',
    caesars: 'Caesars',
    pointsbet: 'PointsBet',
    betrivers: 'BetRivers',
    williamhill_us: 'Caesars (WH)',
    bovada: 'Bovada',
    mybookieag: 'MyBookie',
    betonlineag: 'BetOnline',
    pinnacle: 'Pinnacle',
    betway: 'Betway',
    unibet_us: 'Unibet',
    foxbet: 'FOX Bet',
    superbook: 'SuperBook',
    betus: 'BetUS',
    wynnbet: 'WynnBET',
    si_sportsbook: 'SI Sportsbook',
  };
  return displayNames[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function scoreColor(score: number | null, isDark: boolean): string {
  if (score == null) return isDark ? 'text-gray-400' : 'text-gray-500';
  if (score >= 75) return isDark ? 'text-green-400' : 'text-green-600';
  if (score >= 50) return isDark ? 'text-yellow-400' : 'text-yellow-600';
  return isDark ? 'text-red-400' : 'text-red-500';
}

function scoreBadge(score: number | null, isDark: boolean): string {
  if (score == null) return isDark ? 'bg-gray-700 text-gray-400 border-gray-600' : 'bg-gray-100 text-gray-500 border-gray-300';
  if (score >= 75) return isDark ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-50 text-green-700 border-green-200';
  if (score >= 50) return isDark ? 'bg-yellow-900/50 text-yellow-300 border-yellow-700' : 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return isDark ? 'bg-red-900/50 text-red-300 border-red-700' : 'bg-red-50 text-red-700 border-red-200';
}

function limitBadge(profile: LimitProfile, isDark: boolean): string {
  switch (profile) {
    case 'high':   return isDark ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-200';
    case 'medium': return isDark ? 'bg-purple-900/50 text-purple-300 border-purple-700' : 'bg-purple-50 text-purple-700 border-purple-200';
    case 'low':    return isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-600 border-gray-300';
  }
}

function sharpRatingColor(rating: number, isDark: boolean): string {
  if (rating >= 8) return isDark ? 'text-blue-400' : 'text-blue-600';
  if (rating >= 5) return isDark ? 'text-purple-400' : 'text-purple-600';
  return isDark ? 'text-gray-400' : 'text-gray-500';
}

function formatPercent(value: number | undefined | null): string {
  if (value == null) return '—';
  return `${Math.round(value)}%`;
}

function formatSeconds(value: number | undefined | null): string {
  if (value == null || value === 0) return '—';
  if (value < 60) return `${value}s`;
  return `${Math.round(value / 60)}m`;
}

const CRITERIA_OPTIONS: { value: BookmakerRankingCriteria; label: string; desc: string }[] = [
  { value: 'recommendation', label: 'Recommended',  desc: 'Overall composite score' },
  { value: 'value',          label: 'Best Value',   desc: 'Best odds frequency & CLV' },
  { value: 'sharpness',      label: 'Sharpest',     desc: 'First mover & efficiency' },
  { value: 'reliability',    label: 'Most Reliable', desc: 'Uptime & market efficiency' },
  { value: 'coverage',       label: 'Best Coverage', desc: 'Markets & games offered' },
  { value: 'limits',         label: 'Highest Limits', desc: 'Estimated max bet' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RankingRow({
  rank,
  bm,
  isDarkMode,
  isSelected,
  onSelect,
}: {
  rank: number;
  bm: BookmakerAnalytics;
  isDarkMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const rowBg = isSelected
    ? isDarkMode ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'
    : isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' : 'bg-white border-gray-200 hover:bg-gray-50';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-4 transition-colors cursor-pointer ${rowBg}`}
    >
      <div className="flex items-center gap-4">
        {/* Rank badge */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          rank === 1 ? (isDarkMode ? 'bg-yellow-800 text-yellow-200' : 'bg-yellow-100 text-yellow-700') :
          rank === 2 ? (isDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700') :
          rank === 3 ? (isDarkMode ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-700') :
          (isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500')
        }`}>
          {rank}
        </div>

        {/* Name + limit badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold text-sm ${textPrimary}`}>
              {formatBookmakerName(bm.bookmaker)}
            </p>
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${limitBadge(bm.limitProfile, isDarkMode)}`}>
              {bm.limitProfile.charAt(0).toUpperCase() + bm.limitProfile.slice(1)} limits
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${textSecondary}`}>
            {bm.totalGamesOffered} games · {bm.sportsCovered.length} sports
          </p>
        </div>

        {/* Key stats */}
        <div className="hidden sm:grid grid-cols-3 gap-4 text-center flex-shrink-0">
          <div>
            <p className={`text-xs ${textSecondary}`}>Score</p>
            <p className={`text-sm font-bold ${scoreColor(bm.recommendationScore, isDarkMode)}`}>
              {bm.recommendationScore != null ? Math.round(bm.recommendationScore) : '—'}
            </p>
          </div>
          <div>
            <p className={`text-xs ${textSecondary}`}>Sharp</p>
            <p className={`text-sm font-bold ${sharpRatingColor(bm.sharpBookRating, isDarkMode)}`}>
              {bm.sharpBookRating}/10
            </p>
          </div>
          <div>
            <p className={`text-xs ${textSecondary}`}>Best Odds</p>
            <p className={`text-sm font-bold ${textPrimary}`}>
              {formatPercent(bm.bestOddsFrequency)}
            </p>
          </div>
        </div>

        {/* Recommendation score pill */}
        <div className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded border ${scoreBadge(bm.recommendationScore, isDarkMode)}`}>
          {bm.recommendationScore != null ? `${Math.round(bm.recommendationScore)}/100` : '—'}
        </div>

        {/* Chevron */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 ${textSecondary} transition-transform ${isSelected ? 'rotate-90' : ''}`}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
  isDarkMode,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  return (
    <div className={`rounded-lg border p-4 ${cardBg}`}>
      <p className={`text-xs ${textSecondary} mb-1`}>{label}</p>
      <p className={`text-2xl font-bold ${textPrimary}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${textSecondary}`}>{sub}</p>}
    </div>
  );
}

function DetailPanel({
  bm,
  isDarkMode,
  outlierStats,
  outlierLoading,
  outlierDays,
  onOutlierDaysChange,
}: {
  bm: BookmakerAnalytics;
  isDarkMode: boolean;
  outlierStats: ReturnType<typeof selectOutlierStats>;
  outlierLoading: boolean;
  outlierDays: number;
  onOutlierDaysChange: (days: number) => void;
}) {
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const pillBg = isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`rounded-lg border p-4 ${cardBg}`}>
        <div className="flex items-start gap-4">
          <div>
            <h2 className={`text-xl font-bold ${textPrimary}`}>{formatBookmakerName(bm.bookmaker)}</h2>
            <p className={`text-sm ${textSecondary}`}>{bm.bookmaker}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <span className={`text-sm font-bold px-2 py-1 rounded border ${scoreBadge(bm.recommendationScore, isDarkMode)}`}>
              {bm.recommendationScore != null ? `${Math.round(bm.recommendationScore)}/100 score` : '— score'}
            </span>
            <span className={`text-sm px-2 py-1 rounded border font-medium ${limitBadge(bm.limitProfile, isDarkMode)}`}>
              {bm.limitProfile.charAt(0).toUpperCase() + bm.limitProfile.slice(1)} limits · ~${bm.estimatedMaxBet.toLocaleString()} max
            </span>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Sharp Book Rating"
          value={<span className={sharpRatingColor(bm.sharpBookRating, isDarkMode)}>{bm.sharpBookRating}/10</span>}
          sub="Based on first-mover frequency"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Best Odds Frequency"
          value={formatPercent(bm.bestOddsFrequency)}
          sub="% of markets with best line"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Market Efficiency"
          value={<span className={scoreColor(bm.marketEfficiency, isDarkMode)}>{Math.round(bm.marketEfficiency)}</span>}
          sub="0–100 composite score"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Uptime"
          value={formatPercent(bm.uptimePercentage)}
          sub="Odds availability rate"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Movement & timing */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="First Mover Rate"
          value={formatPercent(bm.firstMoverFrequency)}
          sub="% of events led by this book"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Movement Lag"
          value={formatSeconds(bm.lineMovementLag)}
          sub="Avg time behind first mover"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Odds Update Freq"
          value={formatSeconds(bm.oddsUpdateFrequency)}
          sub="Avg seconds between updates"
          isDarkMode={isDarkMode}
        />
        <StatCard
          label="Outlier Rate"
          value={formatPercent(bm.outlierFrequency)}
          sub="% of markets off consensus"
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Coverage */}
      <div className={`rounded-lg border p-4 ${cardBg}`}>
        <p className={`font-semibold text-sm mb-3 ${textPrimary}`}>Market Coverage</p>
        <div className="mb-3">
          <p className={`text-xs ${textSecondary} mb-1.5`}>
            Sports ({bm.sportsCovered.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bm.sportsCovered.length > 0 ? bm.sportsCovered.map(sport => (
              <span key={sport} className={`text-xs px-2 py-0.5 rounded ${pillBg}`}>{sport}</span>
            )) : (
              <span className={`text-xs ${textSecondary}`}>No data</span>
            )}
          </div>
        </div>
        <div>
          <p className={`text-xs ${textSecondary} mb-1.5`}>
            Market types ({bm.marketsCovered.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bm.marketsCovered.length > 0 ? bm.marketsCovered.map(m => (
              <span key={m} className={`text-xs px-2 py-0.5 rounded ${pillBg}`}>{m}</span>
            )) : (
              <span className={`text-xs ${textSecondary}`}>No data</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className={`text-xs ${textSecondary}`}>Total Games</p>
            <p className={`text-lg font-bold ${textPrimary}`}>{bm.totalGamesOffered.toLocaleString()}</p>
          </div>
          <div>
            <p className={`text-xs ${textSecondary}`}>Total Markets</p>
            <p className={`text-lg font-bold ${textPrimary}`}>{bm.totalMarketsOffered.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Outlier stats */}
      <div className={`rounded-lg border p-4 ${cardBg}`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`font-semibold text-sm ${textPrimary}`}>Consensus Outlier Analysis</p>
          <div className="flex items-center gap-2">
            <label className={`text-xs ${textSecondary}`}>Window:</label>
            <select
              value={outlierDays}
              onChange={(e) => onOutlierDaysChange(parseInt(e.target.value))}
              className={`text-xs rounded border px-2 py-1 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
            >
              {[7, 30, 90].map(d => (
                <option key={d} value={d}>{d}d</option>
              ))}
            </select>
          </div>
        </div>

        {outlierLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : outlierStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className={`text-xs ${textSecondary}`}>Records Analyzed</p>
              <p className={`text-lg font-bold ${textPrimary}`}>{outlierStats.totalRecords.toLocaleString()}</p>
            </div>
            <div>
              <p className={`text-xs ${textSecondary}`}>Outlier Count</p>
              <p className={`text-lg font-bold ${textPrimary}`}>{outlierStats.outlierCount.toLocaleString()}</p>
            </div>
            <div>
              <p className={`text-xs ${textSecondary}`}>Outlier Rate</p>
              <p className={`text-lg font-bold ${scoreColor(100 - outlierStats.outlierRate, isDarkMode)}`}>
                {outlierStats.outlierRate.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className={`text-xs ${textSecondary}`}>Avg Deviation</p>
              <p className={`text-lg font-bold ${textPrimary}`}>{outlierStats.avgDeviation.toFixed(2)}σ</p>
            </div>
          </div>
        ) : (
          <p className={`text-sm ${textSecondary}`}>No outlier data available for this window.</p>
        )}
        <p className={`text-xs mt-3 ${textSecondary}`}>
          ⓘ Outliers are markets where this book's line deviates significantly from the consensus across all bookmakers.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookmakerPerformance() {
  const dispatch = useDispatch<AppDispatch>();
  const { isDarkMode } = useDarkMode();

  const rankings = useSelector(selectRankings);
  const selectedBookmaker = useSelector(selectSelectedBookmaker);
  const outlierStats = useSelector(selectOutlierStats);
  const loading = useSelector(selectBookmakerLoading);
  const detailLoading = useSelector(selectBookmakerDetailLoading);
  const outlierLoading = useSelector(selectBookmakerOutlierLoading);
  const error = useSelector(selectBookmakerError);

  const [activeTab, setActiveTab] = useState<'rankings' | 'detail'>('rankings');
  const [criteria, setCriteria] = useState<BookmakerRankingCriteria>('recommendation');
  const [outlierDays, setOutlierDays] = useState(30);

  useEffect(() => {
    dispatch(fetchRankings(criteria));
  }, [dispatch, criteria]);

  const handleSelectBookmaker = (bm: BookmakerAnalytics) => {
    setActiveTab('detail');
    dispatch(fetchBookmakerDetail(bm.bookmaker));
    dispatch(fetchOutlierStats({ bookmaker: bm.bookmaker, days: outlierDays }));
  };

  const handleOutlierDaysChange = (days: number) => {
    setOutlierDays(days);
    if (selectedBookmaker) {
      dispatch(fetchOutlierStats({ bookmaker: selectedBookmaker.bookmaker, days }));
    }
  };

  const bgPage = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const bgHeader = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const tabActive = 'bg-blue-600 text-white';
  const tabInactive = isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900';

  const totalBooks = rankings.length;
  const avgScore = totalBooks > 0
    ? Math.round(rankings.reduce((sum, b) => sum + (b.recommendationScore ?? 0), 0) / totalBooks)
    : 0;
  const highLimitCount = rankings.filter(b => b.limitProfile === 'high').length;

  return (
    <div className={`min-h-screen ${bgPage}`}>
      {/* Page header */}
      <div className={`border-b ${bgHeader}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">📊</span>
            <div>
              <h1 className={`text-3xl font-bold ${textPrimary}`}>
                Bookmaker Performance
              </h1>
              <p className={textSecondary}>
                Compare sportsbooks by value, sharpness, reliability, and market coverage
              </p>
            </div>
          </div>

          {/* Summary stats */}
          {totalBooks > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Bookmakers Ranked', value: totalBooks },
                { label: 'Avg Score', value: `${avgScore}/100` },
                { label: 'High-Limit Books', value: highLimitCount },
              ].map(stat => (
                <div key={stat.label} className={`rounded-lg border p-3 ${cardBg}`}>
                  <p className={`text-xs ${textSecondary}`}>{stat.label}</p>
                  <p className={`text-xl font-bold ${textPrimary}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 text-sm">
            <button
              onClick={() => setActiveTab('rankings')}
              className={`px-4 py-2 font-medium transition-colors ${activeTab === 'rankings' ? tabActive : tabInactive}`}
            >
              📊 Rankings
            </button>
            <button
              onClick={() => setActiveTab('detail')}
              className={`px-4 py-2 font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${activeTab === 'detail' ? tabActive : tabInactive}`}
              disabled={!selectedBookmaker && rankings.length === 0}
            >
              🔍 Detail
            </button>
          </div>

          {/* Criteria selector — only on rankings tab */}
          {activeTab === 'rankings' && (
            <div className="flex items-center gap-2 ml-auto">
              <label className={`text-sm ${textSecondary}`}>Sort by:</label>
              <select
                value={criteria}
                onChange={(e) => setCriteria(e.target.value as BookmakerRankingCriteria)}
                className={`text-sm rounded border px-2 py-1.5 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                {CRITERIA_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Criteria description */}
        {activeTab === 'rankings' && (
          <div className={`rounded-lg border p-3 mb-4 text-sm ${isDarkMode ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            <strong>{CRITERIA_OPTIONS.find(o => o.value === criteria)?.label}:</strong>{' '}
            {CRITERIA_OPTIONS.find(o => o.value === criteria)?.desc}. Click any row to view full details.
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={`rounded-lg border p-4 mb-4 ${isDarkMode ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {error}
          </div>
        )}

        {/* Rankings tab */}
        {activeTab === 'rankings' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            ) : rankings.length === 0 ? (
              <div className={`text-center py-16 ${textSecondary}`}>
                <p className="text-4xl mb-3">📊</p>
                <p className="text-lg font-medium">No bookmaker data yet</p>
                <p className="text-sm mt-1">Rankings are calculated from odds data captured over the last 30 days.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rankings.map((bm, i) => (
                  <RankingRow
                    key={bm.bookmaker}
                    rank={i + 1}
                    bm={bm}
                    isDarkMode={isDarkMode}
                    isSelected={selectedBookmaker?.bookmaker === bm.bookmaker}
                    onSelect={() => handleSelectBookmaker(bm)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Detail tab */}
        {activeTab === 'detail' && (
          <>
            {/* Bookmaker selector (from rankings) */}
            {rankings.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <label className={`text-sm ${textSecondary}`}>Bookmaker:</label>
                <select
                  value={selectedBookmaker?.bookmaker || ''}
                  onChange={(e) => {
                    const bm = rankings.find(b => b.bookmaker === e.target.value);
                    if (bm) handleSelectBookmaker(bm);
                  }}
                  className={`text-sm rounded border px-2 py-1.5 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="" disabled>Select a bookmaker…</option>
                  {rankings.map(bm => (
                    <option key={bm.bookmaker} value={bm.bookmaker}>
                      {formatBookmakerName(bm.bookmaker)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
              </div>
            ) : selectedBookmaker ? (
              <DetailPanel
                bm={selectedBookmaker}
                isDarkMode={isDarkMode}
                outlierStats={outlierStats}
                outlierLoading={outlierLoading}
                outlierDays={outlierDays}
                onOutlierDaysChange={handleOutlierDaysChange}
              />
            ) : (
              <div className={`text-center py-16 ${textSecondary}`}>
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-lg font-medium">Select a bookmaker</p>
                <p className="text-sm mt-1">
                  Pick one from the Rankings tab or the dropdown above to view full performance details.
                </p>
              </div>
            )}
          </>
        )}

        {/* Legend */}
        <div className={`mt-8 rounded-lg border p-4 text-sm ${cardBg}`}>
          <p className={`font-semibold mb-2 ${textPrimary}`}>How Rankings Work</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: '🎯', label: 'Recommendation Score', desc: 'Composite: 40% value + 35% reliability + 15% coverage + 10% sharpness.' },
              { icon: '⚡', label: 'Sharp Book Rating', desc: 'Derived from first-mover frequency, best-odds rate, and market efficiency (1–10).' },
              { icon: '💰', label: 'Best Odds Frequency', desc: '% of consensus snapshots where this book offered the best line.' },
              { icon: '📡', label: 'First Mover Rate', desc: '% of detected line movements that this book initiated.' },
              { icon: '⚠️', label: 'Outlier Rate', desc: "% of markets where this book's line deviates significantly from consensus." },
              { icon: '🏦', label: 'Limit Profile', desc: 'Estimated bet limits: High ≥$5k, Medium ≥$1.5k, Low < $1.5k.' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-2">
                <span className="text-base">{item.icon}</span>
                <div>
                  <span className={`font-medium ${textPrimary}`}>{item.label}:</span>{' '}
                  <span className={textSecondary}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
