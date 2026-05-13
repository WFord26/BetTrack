/**
 * Sharp vs Public Money Analytics Page
 * Displays sharp-action indicators, contrarian opportunities, and market sentiment
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import {
  fetchLiveIndicators,
  fetchContrarianOpportunities,
  fetchSharpStats,
  selectLiveIndicators,
  selectContrarianOpportunities,
  selectSharpStats,
  selectSharpLoading,
  selectSharpError,
} from '../store/sharpSlice';
import { useDarkMode } from '../contexts/DarkModeContext';
import { SharpIndicator, ContrarianOpportunity, SharpSide } from '../types/sharp.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceBadge(score: number, isDark: boolean): string {
  if (score >= 8) return isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800';
  if (score >= 6) return isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
  return isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800';
}

function sideLabel(side: SharpSide, homeTeam?: string, awayTeam?: string): string {
  if (side === 'home' && homeTeam) return homeTeam;
  if (side === 'away' && awayTeam) return awayTeam;
  return side.charAt(0).toUpperCase() + side.slice(1);
}

function movementIcon(movement: string): string {
  switch (movement) {
    case 'steam':   return '🔥';
    case 'reverse': return '↩️';
    case 'gradual': return '📉';
    default:        return '—';
  }
}

function marketLabel(market: string): string {
  switch (market) {
    case 'h2h':    return 'Moneyline';
    case 'spreads': return 'Spread';
    case 'totals':  return 'Total';
    default:        return market;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IndicatorCard({
  indicator,
  isDarkMode,
}: {
  indicator: SharpIndicator;
  isDarkMode: boolean;
}) {
  const game = indicator.game;
  const homeTeam = game?.homeTeamName;
  const awayTeam = game?.awayTeamName;

  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`rounded-lg border p-4 ${cardBg}`}>
      {game && (
        <div className="mb-2">
          <p className={`font-semibold text-sm ${textPrimary}`}>
            {awayTeam} @ {homeTeam}
          </p>
          <p className={`text-xs ${textSecondary}`}>
            {game.sport?.name} · {new Date(game.commenceTime).toLocaleString()}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          {marketLabel(indicator.marketType)}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${confidenceBadge(indicator.sharpConfidence, isDarkMode)}`}>
          {indicator.sharpConfidence}/10 confidence
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className={`rounded p-2 ${isDarkMode ? 'bg-blue-900/40' : 'bg-blue-50'}`}>
          <p className={`text-xs font-medium ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
            Sharp Money 💰
          </p>
          <p className={`text-sm font-semibold mt-0.5 ${isDarkMode ? 'text-blue-100' : 'text-blue-900'}`}>
            {sideLabel(indicator.sharpSide, homeTeam, awayTeam)}
          </p>
        </div>
        <div className={`rounded p-2 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-50'}`}>
          <p className={`text-xs font-medium ${textSecondary}`}>
            Public Money 👥
          </p>
          <p className={`text-sm font-semibold mt-0.5 ${textPrimary}`}>
            {sideLabel(indicator.publicSide, homeTeam, awayTeam)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-base">{movementIcon(indicator.lineMovement)}</span>
        <span className={`text-xs ${textSecondary}`}>
          {indicator.lineMovement === 'no_movement' ? 'No line movement' : `${indicator.lineMovement.charAt(0).toUpperCase() + indicator.lineMovement.slice(1)} move`}
        </span>
      </div>

      {indicator.contraindicators.length > 0 && (
        <div className="mt-2">
          <p className={`text-xs ${textSecondary}`}>
            ⚠️ {indicator.contraindicators.map(c => c.replace(/_/g, ' ')).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

function ContrarianCard({
  opportunity,
  isDarkMode,
}: {
  opportunity: ContrarianOpportunity;
  isDarkMode: boolean;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`rounded-lg border p-4 ${cardBg}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className={`font-semibold text-sm ${textPrimary}`}>
            {opportunity.awayTeamName} @ {opportunity.homeTeamName}
          </p>
          <p className={`text-xs ${textSecondary}`}>
            {opportunity.sportKey} · {new Date(opportunity.commenceTime).toLocaleString()}
          </p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${confidenceBadge(opportunity.maxConfidence, isDarkMode)}`}>
          {opportunity.maxConfidence}/10
        </span>
      </div>

      <div className="space-y-2">
        {opportunity.indicators.map((ind, i) => (
          <div
            key={i}
            className={`flex items-center justify-between text-xs rounded px-2 py-1.5 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}
          >
            <span className={`font-medium ${textSecondary}`}>{marketLabel(ind.marketType)}</span>
            <span className={`${isDarkMode ? 'text-blue-300' : 'text-blue-600'} font-medium`}>
              Sharp → {sideLabel(ind.sharpSide, opportunity.homeTeamName, opportunity.awayTeamName)}
            </span>
            <span className={textSecondary}>{movementIcon(ind.lineMovement)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharpMoneyAnalytics() {
  const dispatch = useDispatch<AppDispatch>();
  const { isDarkMode } = useDarkMode();

  const liveIndicators = useSelector(selectLiveIndicators);
  const contrarianOpportunities = useSelector(selectContrarianOpportunities);
  const stats = useSelector(selectSharpStats);
  const loading = useSelector(selectSharpLoading);
  const error = useSelector(selectSharpError);

  const [activeTab, setActiveTab] = useState<'live' | 'contrarian'>('live');
  const [minConfidence, setMinConfidence] = useState(6);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    // Initial load: fetch stats once (not dependent on tab/filter changes)
    dispatch(fetchSharpStats(24));
  }, [dispatch]);

  useEffect(() => {
    // Re-fetch tab data whenever tab, minConfidence, or limit changes
    if (activeTab === 'live') {
      dispatch(fetchLiveIndicators(limit));
    } else {
      dispatch(fetchContrarianOpportunities({ minConfidence, limit }));
    }
  }, [dispatch, activeTab, minConfidence, limit]);

  const bgPage = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const bgHeader = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const tabActive = isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white';
  const tabInactive = isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900';

  return (
    <div className={`min-h-screen ${bgPage}`}>
      {/* Header */}
      <div className={`border-b ${bgHeader}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🦈</span>
            <div>
              <h1 className={`text-3xl font-bold ${textPrimary}`}>
                Sharp vs Public Money
              </h1>
              <p className={textSecondary}>
                Track professional bettor action and fade the public
              </p>
            </div>
          </div>

          {/* Stats summary */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'Total Indicators', value: stats.totalIndicators },
                { label: 'Avg Confidence', value: `${stats.avgConfidence}/10` },
                { label: 'Steam Moves', value: stats.byLineMovement['steam'] || 0 },
                { label: 'Reverse Lines', value: stats.byLineMovement['reverse'] || 0 },
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
        {/* Tabs + filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 text-sm">
            <button
              onClick={() => setActiveTab('live')}
              className={`px-4 py-2 font-medium transition-colors ${activeTab === 'live' ? tabActive : tabInactive}`}
            >
              🔴 Live Indicators
            </button>
            <button
              onClick={() => setActiveTab('contrarian')}
              className={`px-4 py-2 font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${activeTab === 'contrarian' ? tabActive : tabInactive}`}
            >
              ↩️ Contrarian Picks
            </button>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {activeTab === 'contrarian' && (
              <div className="flex items-center gap-2">
                <label className={`text-sm ${textSecondary}`}>Min confidence:</label>
                <select
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                  className={`text-sm rounded border px-2 py-1 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  {[4, 5, 6, 7, 8].map(v => (
                    <option key={v} value={v}>{v}/10</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className={`text-sm ${textSecondary}`}>Show:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className={`text-sm rounded border px-2 py-1 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                {[10, 20, 50].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className={`rounded-lg border p-4 mb-4 ${isDarkMode ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        )}

        {/* Live indicators grid */}
        {!loading && activeTab === 'live' && (
          <>
            {liveIndicators.length === 0 ? (
              <div className={`text-center py-16 ${textSecondary}`}>
                <p className="text-4xl mb-3">🦈</p>
                <p className="text-lg font-medium">No sharp activity detected</p>
                <p className="text-sm mt-1">Sharp indicators are calculated every 15 minutes from line movement data.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveIndicators.map(ind => (
                  <IndicatorCard key={ind.id} indicator={ind} isDarkMode={isDarkMode} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Contrarian opportunities grid */}
        {!loading && activeTab === 'contrarian' && (
          <>
            <div className={`rounded-lg border p-3 mb-4 text-sm ${isDarkMode ? 'bg-blue-900/20 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              <strong>💡 Fade the Public:</strong> These games show sharp money on the less-popular side. Historically, fading heavy public sides can be profitable.
            </div>
            {contrarianOpportunities.length === 0 ? (
              <div className={`text-center py-16 ${textSecondary}`}>
                <p className="text-4xl mb-3">↩️</p>
                <p className="text-lg font-medium">No contrarian opportunities found</p>
                <p className="text-sm mt-1">Try lowering the minimum confidence threshold.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {contrarianOpportunities.map(opp => (
                  <ContrarianCard key={opp.gameId} opportunity={opp} isDarkMode={isDarkMode} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Legend */}
        <div className={`mt-8 rounded-lg border p-4 text-sm ${cardBg}`}>
          <p className={`font-semibold mb-2 ${textPrimary}`}>How to Read These Indicators</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: '🔥', label: 'Steam Move', desc: '3+ books move quickly in the same direction — classic sharp action.' },
              { icon: '↩️', label: 'Reverse Line', desc: 'Line moves against the public betting side — sharp money opposing the crowd.' },
              { icon: '📉', label: 'Gradual Move', desc: 'Slow drift over several hours — moderate signal, possibly sharp.' },
              { icon: '💰', label: 'Sharp Side', desc: 'The side professional bettors are backing based on line movement analysis.' },
              { icon: '👥', label: 'Public Side', desc: 'The opposite side — likely where recreational bettors are wagering.' },
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
