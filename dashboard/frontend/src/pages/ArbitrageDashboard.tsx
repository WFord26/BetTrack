/**
 * Arbitrage Dashboard
 *
 * Live arbitrage and middle opportunities, a stake calculator, and alert
 * thresholds. Every card carries the age of the odds snapshot it was computed
 * from, because odds refresh on the sync cadence rather than continuously.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import {
  fetchLiveArbitrage,
  fetchArbitrageStats,
  takeOpportunity,
  selectLiveArbitrage,
  selectArbitrageStats,
  selectArbitrageLoading,
  selectArbitrageError,
  selectArbitrageLastFetched,
  selectAlertingOpportunities,
} from '../store/arbitrageSlice';
import { useDarkMode } from '../contexts/DarkModeContext';
import { ArbitrageOpportunity, ArbRiskLevel } from '../types/arbitrage.types';
import { formatCurrency, formatRelativeTime } from '../utils/format';
import ArbitrageCalculator from '../components/analytics/ArbitrageCalculator';
import MiddleFinder from '../components/analytics/MiddleFinder';
import ArbitrageAlerts from '../components/analytics/ArbitrageAlerts';
import SnapshotAgeBadge from '../components/analytics/SnapshotAgeBadge';

const POLL_INTERVAL_MS = 30000;

type TabKey = 'live' | 'middles' | 'calculator' | 'alerts';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'live', label: 'Live Arbitrage' },
  { key: 'middles', label: 'Middles' },
  { key: 'calculator', label: 'Calculator' },
  { key: 'alerts', label: 'Alerts' },
];

function riskBadgeClass(risk: ArbRiskLevel, isDark: boolean): string {
  switch (risk) {
    case 'low':
      return isDark ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800';
    case 'medium':
      return isDark ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800';
    default:
      return isDark ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800';
  }
}

function marketLabel(market: string): string {
  switch (market) {
    case 'h2h':
      return 'Moneyline';
    case 'spreads':
      return 'Spread';
    case 'totals':
      return 'Total';
    default:
      return market;
  }
}

// ─── Opportunity card ─────────────────────────────────────────────────────────

function OpportunityCard({
  opportunity,
  isDarkMode,
  onTake,
}: {
  opportunity: ArbitrageOpportunity;
  isDarkMode: boolean;
  onTake: (id: string) => void;
}) {
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  const profit = Number(opportunity.profitPercentage);
  const isMiddle = opportunity.arbType === 'middle';

  return (
    <div className={`rounded-lg border p-4 ${cardBg}`}>
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <p className={`font-semibold text-sm truncate ${textPrimary}`}>
            {opportunity.game
              ? `${opportunity.game.awayTeamName} @ ${opportunity.game.homeTeamName}`
              : 'Game unavailable'}
          </p>
          <p className={`text-xs ${textSecondary}`}>
            {opportunity.game?.sport?.name} · {marketLabel(opportunity.marketType)} ·{' '}
            {opportunity.game ? new Date(opportunity.game.commenceTime).toLocaleString() : ''}
          </p>
        </div>
        <SnapshotAgeBadge ageSeconds={opportunity.oddsSnapshotAge} isDarkMode={isDarkMode} />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            isMiddle
              ? isDarkMode
                ? 'bg-purple-900 text-purple-200'
                : 'bg-purple-100 text-purple-800'
              : isDarkMode
              ? 'bg-blue-900 text-blue-200'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {isMiddle ? 'Middle' : 'Arbitrage'}
        </span>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${riskBadgeClass(
            opportunity.riskLevel,
            isDarkMode
          )}`}
        >
          {opportunity.riskLevel} risk
        </span>
        <span className="text-lg font-bold text-green-600 dark:text-green-400 ml-auto">
          {profit >= 0 ? '+' : ''}
          {profit.toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {opportunity.legs.map((leg, index) => (
          <div key={index} className={`rounded p-2 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-50'}`}>
            <p className={`text-xs font-medium ${textSecondary}`}>{leg.bookmaker}</p>
            <p className={`text-sm font-semibold ${textPrimary}`}>{leg.label}</p>
            <p className={`text-xs ${textSecondary}`}>
              {leg.odds > 0 ? `+${leg.odds}` : leg.odds} · stake {formatCurrency(leg.stake)} · returns{' '}
              {formatCurrency(leg.toWin)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm mb-2">
        <span className={textSecondary}>
          {formatCurrency(Number(opportunity.stake))} staked
        </span>
        <span className="font-semibold text-green-600 dark:text-green-400">
          {isMiddle ? 'EV ' : 'Profit '}
          {formatCurrency(Number(opportunity.expectedProfit))}
        </span>
      </div>

      {opportunity.riskFactors.length > 0 && (
        <ul className={`text-xs space-y-0.5 mb-3 ${textSecondary}`}>
          {opportunity.riskFactors.map((factor, index) => (
            <li key={index}>• {factor}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <span className={`text-xs ${textSecondary}`}>
          Detected {formatRelativeTime(opportunity.detectedAt)}
        </span>
        <button
          type="button"
          onClick={() => onTake(opportunity.id)}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Mark as taken
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArbitrageDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { isDarkMode } = useDarkMode();

  const opportunities = useSelector(selectLiveArbitrage);
  const alerting = useSelector(selectAlertingOpportunities);
  const stats = useSelector(selectArbitrageStats);
  const loading = useSelector(selectArbitrageLoading);
  const error = useSelector(selectArbitrageError);
  const lastFetched = useSelector(selectArbitrageLastFetched);

  const [tab, setTab] = useState<TabKey>('live');
  const [minProfit, setMinProfit] = useState<number>(0);

  useEffect(() => {
    const load = () => {
      dispatch(fetchLiveArbitrage(minProfit > 0 ? { minProfit } : {}));
      dispatch(fetchArbitrageStats({}));
    };
    load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [dispatch, minProfit]);

  const arbs = useMemo(
    () => opportunities.filter((o) => o.arbType !== 'middle'),
    [opportunities]
  );

  const bookmakers = useMemo(() => {
    const set = new Set<string>();
    opportunities.forEach((o) => o.legs.forEach((leg) => set.add(leg.bookmaker)));
    return Array.from(set).sort();
  }, [opportunities]);

  const sports = useMemo(() => {
    const map = new Map<string, string>();
    opportunities.forEach((o) => {
      if (o.game?.sport) map.set(o.game.sport.key, o.game.sport.name);
    });
    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [opportunities]);

  const handleTake = (id: string) => {
    dispatch(takeOpportunity({ id }));
  };

  const pageBg = isDarkMode ? 'bg-gray-900' : 'bg-gray-50';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className={`text-3xl font-bold mb-2 ${textPrimary}`}>Arbitrage & Middles</h1>
          <p className={textSecondary}>
            Guaranteed profit across bookmakers, plus gaps where both sides can win.
          </p>
        </div>

        {/* Freshness disclosure */}
        <div
          className={`rounded-lg border p-4 mb-6 ${
            isDarkMode
              ? 'bg-amber-900/20 border-amber-800'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <p className={`text-sm font-medium ${isDarkMode ? 'text-amber-200' : 'text-amber-900'}`}>
            Opportunities are only as fresh as the last odds sync
          </p>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-amber-300/80' : 'text-amber-700'}`}>
            Every card shows the age of the snapshot it came from. Always re-check both books before
            placing. Some bookmakers restrict accounts for arbitrage, so keep each leg at a different
            book.
            {lastFetched && ` Last refreshed ${formatRelativeTime(lastFetched)}.`}
          </p>
        </div>

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Active now', value: String(stats.activeNow) },
              { label: 'Alerting', value: String(alerting.length) },
              { label: 'Per day', value: stats.detectionsPerDay.toFixed(1) },
              { label: 'Avg profit', value: `${stats.averageProfitPercentage.toFixed(2)}%` },
              { label: 'Best profit', value: `${stats.bestProfitPercentage.toFixed(2)}%` },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg border p-3 ${cardBg}`}>
                <p className={`text-xs ${textSecondary}`}>{item.label}</p>
                <p className={`text-xl font-bold ${textPrimary}`}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`text-sm font-medium px-4 py-2 rounded-md ${
                tab === item.key
                  ? 'bg-blue-600 text-white'
                  : isDarkMode
                  ? 'bg-gray-800 text-gray-300 border border-gray-700'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div
            className={`rounded-lg border p-4 mb-5 ${
              isDarkMode ? 'bg-red-900/30 border-red-800' : 'bg-red-50 border-red-200'
            }`}
          >
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {tab === 'live' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <label className={`text-xs font-medium ${textSecondary}`} htmlFor="arb-filter-profit">
                Minimum profit %
              </label>
              <input
                id="arb-filter-profit"
                type="number"
                min="0"
                step="0.25"
                value={minProfit}
                onChange={(e) => setMinProfit(parseFloat(e.target.value) || 0)}
                className={`w-24 rounded-md border px-2 py-1 text-sm ${
                  isDarkMode
                    ? 'bg-gray-900 border-gray-700 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            {loading && arbs.length === 0 ? (
              <div className={`rounded-lg border p-6 text-center ${cardBg}`}>
                <p className={textSecondary}>Scanning the latest odds snapshot...</p>
              </div>
            ) : arbs.length === 0 ? (
              <div className={`rounded-lg border p-6 text-center ${cardBg}`}>
                <p className={`text-sm ${textSecondary}`}>
                  No arbitrage in the current snapshot. This is the normal state; opportunities
                  appear when books disagree enough to cover the vig.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {arbs.map((opportunity) => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    isDarkMode={isDarkMode}
                    onTake={handleTake}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'middles' && (
          <MiddleFinder
            opportunities={opportunities}
            isDarkMode={isDarkMode}
            loading={loading && opportunities.length === 0}
          />
        )}

        {tab === 'calculator' && (
          <div className="max-w-2xl">
            <ArbitrageCalculator isDarkMode={isDarkMode} />
          </div>
        )}

        {tab === 'alerts' && (
          <div className="max-w-2xl">
            <ArbitrageAlerts
              isDarkMode={isDarkMode}
              availableBookmakers={bookmakers}
              availableSports={sports}
            />
          </div>
        )}
      </div>
    </div>
  );
}
