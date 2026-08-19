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
  if (score == null) return isDark ? 'text-cream-muted' : 'text-ink-muted';
  if (score >= 75) return isDark ? 'text-sunwin-dark' : 'text-sunwin-light';
  if (score >= 50) return isDark ? 'text-gold' : 'text-sunpending-ink';
  return isDark ? 'text-coral' : 'text-sunloss-light';
}

function scoreBadge(score: number | null, isDark: boolean): string {
  if (score == null) return isDark ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-muted border border-ink';
  if (score >= 75) return isDark ? 'bg-sunwin-chip text-sunwin-dark border border-sunwin-light' : 'bg-sunwin-wash text-sunwin-light border border-sunwin-light';
  if (score >= 50) return isDark ? 'bg-sunpending-chip text-gold border border-gold-edge' : 'bg-sunpending-wash text-sunpending-ink border border-sunpending';
  return isDark ? 'bg-coral-chip text-coral border border-coral' : 'bg-sunloss-wash text-sunloss-light border border-sunloss-light';
}

function limitBadge(profile: LimitProfile, isDark: boolean): string {
  switch (profile) {
    case 'high':   return isDark ? 'bg-dusk-panel2 text-gold border border-gold-edge' : 'bg-sand-panel2 text-terra border-2 border-ink';
    case 'medium': return isDark ? 'bg-dusk-panel2 text-plum border border-plum' : 'bg-sand-panel2 text-plum border-2 border-ink';
    case 'low':    return isDark ? 'bg-dusk-panel2 text-cream-muted border border-dusk-ring' : 'bg-sand-panel2 text-ink-muted border border-sand-divider';
  }
}

function sharpRatingColor(rating: number, isDark: boolean): string {
  if (rating >= 8) return isDark ? 'text-gold' : 'text-terra';
  if (rating >= 5) return isDark ? 'text-plum' : 'text-plum';
  return isDark ? 'text-cream-muted' : 'text-ink-muted';
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
  const rowCls = isSelected
    ? isDarkMode ? 'ds-panel border-l-4 border-gold p-4' : 'ds-card-ink border-l-4 border-terra p-4'
    : isDarkMode ? 'ds-panel p-4 hover:brightness-110 transition-all' : 'ds-card-ink p-4 hover:brightness-105 transition-all';

  return (
    <button onClick={onSelect} className={`w-full text-left cursor-pointer ${rowCls}`}>
      <div className="flex items-center gap-4">
        <div className={`flex-shrink-0 w-9 h-9 flex items-center justify-center font-display text-[11px] ${
          rank === 1 ? (isDarkMode ? 'bg-gold text-dusk' : 'bg-gold text-ink') :
          rank === 2 ? (isDarkMode ? 'bg-dusk-panel2 text-cream-secondary' : 'bg-sand-shadow text-ink-secondary') :
          rank === 3 ? (isDarkMode ? 'bg-sunpending-chip text-ember' : 'bg-sand-bronze text-terra') :
          (isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-muted border border-ink')
        }`}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-body font-semibold text-sm ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
              {formatBookmakerName(bm.bookmaker)}
            </p>
            <span className={`font-display text-[6px] tracking-[.06em] px-1.5 py-0.5 ${limitBadge(bm.limitProfile, isDarkMode)}`}>
              {bm.limitProfile.charAt(0).toUpperCase() + bm.limitProfile.slice(1)} limits
            </span>
          </div>
          <p className={`font-body text-xs mt-0.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
            {bm.totalGamesOffered} games · {bm.sportsCovered.length} sports
          </p>
        </div>

        <div className="hidden sm:grid grid-cols-3 gap-4 text-center flex-shrink-0">
          <div>
            <p className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>SCORE</p>
            <p className={`font-display text-[11px] mt-1 ${scoreColor(bm.recommendationScore, isDarkMode)}`}>
              {bm.recommendationScore != null ? Math.round(bm.recommendationScore) : '—'}
            </p>
          </div>
          <div>
            <p className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>SHARP</p>
            <p className={`font-display text-[11px] mt-1 ${sharpRatingColor(bm.sharpBookRating, isDarkMode)}`}>
              {bm.sharpBookRating}/10
            </p>
          </div>
          <div>
            <p className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>BEST ODDS</p>
            <p className={`font-display text-[11px] mt-1 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
              {formatPercent(bm.bestOddsFrequency)}
            </p>
          </div>
        </div>

        <div className={`flex-shrink-0 font-display text-[7px] tracking-[.04em] px-2 py-1 ${scoreBadge(bm.recommendationScore, isDarkMode)}`}>
          {bm.recommendationScore != null ? `${Math.round(bm.recommendationScore)}/100` : '—'}
        </div>

        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          className={`flex-shrink-0 transition-transform ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'} ${isSelected ? 'rotate-90' : ''}`}>
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
  const cardCls = isDarkMode ? 'ds-panel p-4' : 'ds-card-ink p-4';
  return (
    <div className={cardCls}>
      <p className={`font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>{label}</p>
      <p className={`font-display text-[16px] mt-2 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>{value}</p>
      {sub && <p className={`font-body text-xs mt-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>{sub}</p>}
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
  const cardCls = isDarkMode ? 'ds-panel' : 'ds-card-ink';
  const pillCls = isDarkMode ? 'bg-dusk-panel2 text-cream-muted font-display text-[6.5px] tracking-[.06em] px-2 py-0.5' : 'bg-sand-panel2 text-ink-muted font-display text-[6.5px] tracking-[.06em] px-2 py-0.5 border border-sand-divider';
  const selectCls = `font-display text-[7px] px-2 py-1.5 focus:outline-none ${isDarkMode ? 'bg-dusk-panel2 text-cream border-0' : 'bg-sand-panel2 text-ink border-2 border-ink'}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`${cardCls} p-4`}>
        <div className="flex items-start gap-4 flex-wrap">
          <div>
            <h2 className={`font-display text-[13px] tracking-wide ${isDarkMode ? 'text-cream' : 'text-ink'}`}>{formatBookmakerName(bm.bookmaker)}</h2>
            <p className={`font-body text-xs mt-1 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>{bm.bookmaker}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <span className={`font-display text-[7px] tracking-[.04em] px-2 py-1 ${scoreBadge(bm.recommendationScore, isDarkMode)}`}>
              {bm.recommendationScore != null ? `${Math.round(bm.recommendationScore)}/100 score` : '— score'}
            </span>
            <span className={`font-display text-[7px] tracking-[.04em] px-2 py-1 ${limitBadge(bm.limitProfile, isDarkMode)}`}>
              {bm.limitProfile.charAt(0).toUpperCase() + bm.limitProfile.slice(1)} limits · ~${bm.estimatedMaxBet.toLocaleString()} max
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Sharp Book Rating" value={<span className={sharpRatingColor(bm.sharpBookRating, isDarkMode)}>{bm.sharpBookRating}/10</span>} sub="Based on first-mover frequency" isDarkMode={isDarkMode} />
        <StatCard label="Best Odds Frequency" value={formatPercent(bm.bestOddsFrequency)} sub="% of markets with best line" isDarkMode={isDarkMode} />
        <StatCard label="Market Efficiency" value={<span className={scoreColor(bm.marketEfficiency, isDarkMode)}>{Math.round(bm.marketEfficiency)}</span>} sub="0–100 composite score" isDarkMode={isDarkMode} />
        <StatCard label="Uptime" value={formatPercent(bm.uptimePercentage)} sub="Odds availability rate" isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="First Mover Rate" value={formatPercent(bm.firstMoverFrequency)} sub="% of events led by this book" isDarkMode={isDarkMode} />
        <StatCard label="Movement Lag" value={formatSeconds(bm.lineMovementLag)} sub="Avg time behind first mover" isDarkMode={isDarkMode} />
        <StatCard label="Odds Update Freq" value={formatSeconds(bm.oddsUpdateFrequency)} sub="Avg seconds between updates" isDarkMode={isDarkMode} />
        <StatCard label="Outlier Rate" value={formatPercent(bm.outlierFrequency)} sub="% of markets off consensus" isDarkMode={isDarkMode} />
      </div>

      {/* Coverage */}
      <div className={`${cardCls} p-4`}>
        <p className={`font-display text-[8px] tracking-[.08em] mb-3 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>MARKET COVERAGE</p>
        <div className="mb-3">
          <p className={`font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
            SPORTS ({bm.sportsCovered.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bm.sportsCovered.length > 0 ? bm.sportsCovered.map(sport => (
              <span key={sport} className={pillCls}>{sport}</span>
            )) : (
              <span className={`font-body text-xs ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>No data</span>
            )}
          </div>
        </div>
        <div>
          <p className={`font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
            MARKET TYPES ({bm.marketsCovered.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bm.marketsCovered.length > 0 ? bm.marketsCovered.map(m => (
              <span key={m} className={pillCls}>{m}</span>
            )) : (
              <span className={`font-body text-xs ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>No data</span>
            )}
          </div>
        </div>
        <div className={`grid grid-cols-2 gap-3 mt-3 pt-3 border-t-2 ${isDarkMode ? 'border-dusk-panel2' : 'border-sand-divider'}`}>
          <div>
            <p className={`font-display text-[6px] tracking-[.1em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>TOTAL GAMES</p>
            <p className={`font-display text-[16px] mt-1 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>{bm.totalGamesOffered.toLocaleString()}</p>
          </div>
          <div>
            <p className={`font-display text-[6px] tracking-[.1em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>TOTAL MARKETS</p>
            <p className={`font-display text-[16px] mt-1 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>{bm.totalMarketsOffered.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Outlier stats */}
      <div className={`${cardCls} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <p className={`font-display text-[8px] tracking-[.08em] ${isDarkMode ? 'text-cream' : 'text-ink'}`}>OUTLIER ANALYSIS</p>
          <div className="flex items-center gap-2">
            <label className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>WINDOW:</label>
            <select value={outlierDays} onChange={(e) => onOutlierDaysChange(parseInt(e.target.value))} className={selectCls}>
              {[7, 30, 90].map(d => (<option key={d} value={d}>{d}d</option>))}
            </select>
          </div>
        </div>

        {outlierLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin h-6 w-6 border-4 border-gold border-t-transparent" />
          </div>
        ) : outlierStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'RECORDS', value: outlierStats.totalRecords.toLocaleString() },
              { label: 'OUTLIERS', value: outlierStats.outlierCount.toLocaleString() },
              { label: 'OUTLIER RATE', value: outlierStats.outlierRate.toFixed(1) + '%', colorFn: () => scoreColor(100 - outlierStats.outlierRate, isDarkMode) },
              { label: 'AVG DEVIATION', value: outlierStats.avgDeviation.toFixed(2) + 'σ' },
            ].map(({ label, value, colorFn }) => (
              <div key={label}>
                <p className={`font-display text-[6px] tracking-[.1em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>{label}</p>
                <p className={`font-display text-[14px] mt-1 ${colorFn ? colorFn() : isDarkMode ? 'text-cream' : 'text-ink'}`}>{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className={`font-body text-sm ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>No outlier data available for this window.</p>
        )}
        <p className={`font-body text-xs mt-3 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
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

  const totalBooks = rankings.length;
  const avgScore = totalBooks > 0
    ? Math.round(rankings.reduce((sum, b) => sum + (b.recommendationScore ?? 0), 0) / totalBooks)
    : 0;
  const highLimitCount = rankings.filter(b => b.limitProfile === 'high').length;

  const pageCls = isDarkMode ? 'min-h-screen bg-dusk' : 'min-h-screen ds-sand-bg';
  const cardCls = isDarkMode ? 'ds-panel' : 'ds-card-ink';
  const tabActiveCls = isDarkMode
    ? 'bg-gold text-dusk shadow-ds-press'
    : 'bg-terra text-terra-text border-2 border-ink shadow-ds-press-ink';
  const tabInactiveCls = isDarkMode
    ? 'bg-dusk-panel2 text-cream-muted'
    : 'bg-sand-panel text-ink-secondary border-2 border-ink';
  const selectCls = `font-display text-[7px] tracking-[.06em] px-2 py-1.5 focus:outline-none ${isDarkMode ? 'bg-dusk-panel2 text-cream border-0' : 'bg-sand-panel2 text-ink border-2 border-ink'}`;

  return (
    <div className={pageCls}>
      {/* Page header */}
      <div className={isDarkMode ? 'bg-dusk-chrome' : 'bg-terra shadow-ds-press-ink-lg'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <p className={`font-display text-[8px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-ember' : 'text-terra-text opacity-80'}`}>
              WHO RUNS THE SALOON
            </p>
            <h1
              className={`ds-headline-banner font-display text-[19px] ${isDarkMode ? 'text-cream' : 'text-terra-text'}`}
            >
              BOOKMAKERS
            </h1>
            <p className={`font-body mt-2 text-sm ${isDarkMode ? 'text-cream-muted' : 'text-terra-muted'}`}>
              Compare sportsbooks by value, sharpness, reliability, and market coverage
            </p>
          </div>

          {/* Summary stats */}
          {totalBooks > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'BOOKS RANKED', value: totalBooks },
                { label: 'AVG SCORE', value: `${avgScore}/100` },
                { label: 'HIGH-LIMIT BOOKS', value: highLimitCount },
              ].map(stat => (
                <div key={stat.label} className={`${cardCls} p-3`}>
                  <p className={`font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>{stat.label}</p>
                  <p className={`font-display text-[16px] ${isDarkMode ? 'text-gold' : 'text-ink'}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex gap-1.5">
            <button onClick={() => setActiveTab('rankings')} className={`font-display text-[7px] tracking-[.06em] px-4 py-2.5 transition-all ${activeTab === 'rankings' ? tabActiveCls : tabInactiveCls}`}>
              RANKINGS
            </button>
            <button onClick={() => setActiveTab('detail')} className={`font-display text-[7px] tracking-[.06em] px-4 py-2.5 transition-all ${activeTab === 'detail' ? tabActiveCls : tabInactiveCls}`} disabled={!selectedBookmaker && rankings.length === 0}>
              DETAIL
            </button>
          </div>

          {activeTab === 'rankings' && (
            <div className="flex items-center gap-2 ml-auto">
              <label className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>SORT BY:</label>
              <select value={criteria} onChange={(e) => setCriteria(e.target.value as BookmakerRankingCriteria)} className={selectCls}>
                {CRITERIA_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {activeTab === 'rankings' && (
          <div className={`p-3 mb-4 ${isDarkMode ? 'bg-dusk-panel2 border border-dusk-ring' : 'bg-sand-panel2 border-2 border-ink'}`}>
            <p className={`font-body text-sm ${isDarkMode ? 'text-cream-secondary' : 'text-ink-secondary'}`}>
              <strong className={isDarkMode ? 'text-gold' : 'text-terra'}>{CRITERIA_OPTIONS.find(o => o.value === criteria)?.label}:</strong>{' '}
              {CRITERIA_OPTIONS.find(o => o.value === criteria)?.desc}. Click any row to view full details.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={`p-4 mb-4 ${isDarkMode ? 'bg-coral-chip border border-coral text-coral' : 'bg-sunloss-wash border-2 border-sunloss-light text-sunloss-light'}`}>
            <p className="font-body text-sm">{error}</p>
          </div>
        )}

        {/* Rankings tab */}
        {activeTab === 'rankings' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-10 w-10 border-4 border-gold border-t-transparent" />
              </div>
            ) : rankings.length === 0 ? (
              <div className={`text-center py-16 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                <p className="text-4xl mb-3">📊</p>
                <p className={`font-display text-[11px] mb-2 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>NO BOOKMAKER DATA YET</p>
                <p className="font-body text-sm">Rankings are calculated from odds data captured over the last 30 days.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rankings.map((bm, i) => (
                  <RankingRow key={bm.bookmaker} rank={i + 1} bm={bm} isDarkMode={isDarkMode} isSelected={selectedBookmaker?.bookmaker === bm.bookmaker} onSelect={() => handleSelectBookmaker(bm)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Detail tab */}
        {activeTab === 'detail' && (
          <>
            {rankings.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <label className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>BOOKMAKER:</label>
                <select value={selectedBookmaker?.bookmaker || ''} onChange={(e) => { const bm = rankings.find(b => b.bookmaker === e.target.value); if (bm) handleSelectBookmaker(bm); }} className={selectCls}>
                  <option value="" disabled>Select a bookmaker…</option>
                  {rankings.map(bm => (<option key={bm.bookmaker} value={bm.bookmaker}>{formatBookmakerName(bm.bookmaker)}</option>))}
                </select>
              </div>
            )}

            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin h-10 w-10 border-4 border-gold border-t-transparent" />
              </div>
            ) : selectedBookmaker ? (
              <DetailPanel bm={selectedBookmaker} isDarkMode={isDarkMode} outlierStats={outlierStats} outlierLoading={outlierLoading} outlierDays={outlierDays} onOutlierDaysChange={handleOutlierDaysChange} />
            ) : (
              <div className={`text-center py-16 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                <p className="text-4xl mb-3">🔍</p>
                <p className={`font-display text-[11px] mb-2 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>SELECT A BOOKMAKER</p>
                <p className="font-body text-sm">Pick one from the Rankings tab or the dropdown above to view full performance details.</p>
              </div>
            )}
          </>
        )}

        {/* Legend */}
        <div className={`mt-8 ${cardCls} p-5`}>
          <p className={`font-display text-[8px] tracking-[.08em] mb-3 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>HOW RANKINGS WORK</p>
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
                  <span className={`font-body font-semibold text-sm ${isDarkMode ? 'text-cream' : 'text-ink'}`}>{item.label}:</span>{' '}
                  <span className={`font-body text-sm ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
