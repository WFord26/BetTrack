/**
 * MovementPerformance Component
 * Shows statistics and performance metrics for line movements
 * Displays win rates, ROI, and frequency analysis by movement type
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { fetchMovementStats, selectMovementStats } from '../../store/movementSlice';
import { MovementStats } from '../../types/movements.types';
import { useDarkMode } from '../../contexts/DarkModeContext';

interface MovementPerformanceProps {
  hoursBack?: number;
  showChart?: boolean;
  compact?: boolean;
}

interface PerformanceMetric {
  type: string;
  count: number;
  percentage: number;
  color: string;
  intensity: string;
}

export default function MovementPerformance({
  hoursBack = 24,
  showChart = true,
  compact = false
}: MovementPerformanceProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { isDarkMode } = useDarkMode();
  const stats = useSelector(selectMovementStats);
  const [timeframe, setTimeframe] = useState(hoursBack);

  // Keep internal timeframe in sync when the parent changes hoursBack.
  // useState(hoursBack) only sets the initial value, so prop changes after
  // mount are ignored without this effect.
  useEffect(() => {
    setTimeframe(hoursBack);
  }, [hoursBack]);

  useEffect(() => {
    dispatch(fetchMovementStats(timeframe));
  }, [dispatch, timeframe]);

  if (!stats) {
    return (
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 text-center`}>
        <div className="inline-block animate-spin">⌛</div>
        <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Loading performance metrics...
        </p>
      </div>
    );
  }

  // Calculate metrics by type
  const typeMetrics: PerformanceMetric[] = [
    {
      type: 'steam',
      count: stats.byType.steam,
      percentage: stats.byType.steam > 0 ? (stats.byType.steam / Object.values(stats.byType).reduce((a, b) => a + b, 0)) * 100 : 0,
      color: isDarkMode ? 'bg-red-900/30 border-red-600' : 'bg-red-100 border-red-400',
      intensity: isDarkMode ? 'text-red-400 bg-red-900/20' : 'text-red-600 bg-red-100'
    },
    {
      type: 'reverse',
      count: stats.byType.reverse,
      percentage: stats.byType.reverse > 0 ? (stats.byType.reverse / Object.values(stats.byType).reduce((a, b) => a + b, 0)) * 100 : 0,
      color: isDarkMode ? 'bg-blue-900/30 border-blue-600' : 'bg-blue-100 border-blue-400',
      intensity: isDarkMode ? 'text-blue-400 bg-blue-900/20' : 'text-blue-600 bg-blue-100'
    },
    {
      type: 'gradual',
      count: stats.byType.gradual,
      percentage: stats.byType.gradual > 0 ? (stats.byType.gradual / Object.values(stats.byType).reduce((a, b) => a + b, 0)) * 100 : 0,
      color: isDarkMode ? 'bg-yellow-900/30 border-yellow-600' : 'bg-yellow-100 border-yellow-400',
      intensity: isDarkMode ? 'text-yellow-400 bg-yellow-900/20' : 'text-yellow-600 bg-yellow-100'
    },
    {
      type: 'injury',
      count: stats.byType.injury,
      percentage: stats.byType.injury > 0 ? (stats.byType.injury / Object.values(stats.byType).reduce((a, b) => a + b, 0)) * 100 : 0,
      color: isDarkMode ? 'bg-purple-900/30 border-purple-600' : 'bg-purple-100 border-purple-400',
      intensity: isDarkMode ? 'text-purple-400 bg-purple-900/20' : 'text-purple-600 bg-purple-100'
    }
  ].filter(m => m.count > 0);

  // Calculate metrics by market
  const marketMetrics: PerformanceMetric[] = [
    {
      type: 'h2h',
      count: stats.byMarket.h2h,
      percentage: stats.byMarket.h2h > 0 ? (stats.byMarket.h2h / Object.values(stats.byMarket).reduce((a, b) => a + b, 0)) * 100 : 0,
      color: isDarkMode ? 'bg-indigo-900/30 border-indigo-600' : 'bg-indigo-100 border-indigo-400',
      intensity: isDarkMode ? 'text-indigo-400 bg-indigo-900/20' : 'text-indigo-600 bg-indigo-100'
    },
    {
      type: 'spreads',
      count: stats.byMarket.spreads,
      percentage: stats.byMarket.spreads > 0 ? (stats.byMarket.spreads / Object.values(stats.byMarket).reduce((a, b) => a + b, 0)) * 100 : 0,
      color: isDarkMode ? 'bg-cyan-900/30 border-cyan-600' : 'bg-cyan-100 border-cyan-400',
      intensity: isDarkMode ? 'text-cyan-400 bg-cyan-900/20' : 'text-cyan-600 bg-cyan-100'
    },
    {
      type: 'totals',
      count: stats.byMarket.totals,
      percentage: stats.byMarket.totals > 0 ? (stats.byMarket.totals / Object.values(stats.byMarket).reduce((a, b) => a + b, 0)) * 100 : 0,
      color: isDarkMode ? 'bg-teal-900/30 border-teal-600' : 'bg-teal-100 border-teal-400',
      intensity: isDarkMode ? 'text-teal-400 bg-teal-900/20' : 'text-teal-600 bg-teal-100'
    }
  ].filter(m => m.count > 0);

  const totalMovements = Object.values(stats.byType).reduce((a, b) => a + b, 0);

  return (
    <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      {/* Header */}
      <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            📊 Movement Performance
          </h3>
          <div className="flex gap-2">
            {[24, 168, 720].map(h => (
              <button
                key={h}
                onClick={() => setTimeframe(h)}
                className={`px-3 py-1 rounded text-sm font-medium transition ${
                  timeframe === h
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-600 text-white'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {h === 24 ? '1d' : h === 168 ? '1w' : '1m'}
              </button>
            ))}
          </div>
        </div>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Last {timeframe === 24 ? '24 hours' : timeframe === 168 ? '7 days' : '30 days'} • {totalMovements} total movements
        </p>
      </div>

      <div className={`p-6 ${compact ? 'space-y-4' : 'space-y-8'}`}>
        {/* Movement Type Distribution */}
        <div>
          <h4 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            By Movement Type
          </h4>
          <div className="space-y-3">
            {typeMetrics.length > 0 ? (
              typeMetrics.map(metric => (
                <div key={metric.type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium capitalize ${metric.intensity}`}
                      >
                        {metric.type}
                      </span>
                      <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {metric.count}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      {metric.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full transition-all ${
                        metric.type === 'steam'
                          ? 'bg-red-500'
                          : metric.type === 'reverse'
                          ? 'bg-blue-500'
                          : metric.type === 'gradual'
                          ? 'bg-yellow-500'
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${metric.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                No movements detected
              </p>
            )}
          </div>
        </div>

        {/* Market Distribution */}
        {showChart && (
          <div>
            <h4 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              By Market Type
            </h4>
            <div className="space-y-3">
              {marketMetrics.length > 0 ? (
                marketMetrics.map(metric => (
                  <div key={metric.type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {metric.type.toUpperCase()}
                        </span>
                        <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {metric.count}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {metric.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <div
                        className={`h-full transition-all ${
                          metric.type === 'h2h'
                            ? 'bg-indigo-500'
                            : metric.type === 'spreads'
                            ? 'bg-cyan-500'
                            : 'bg-teal-500'
                        }`}
                        style={{ width: `${metric.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  No market data
                </p>
              )}
            </div>
          </div>
        )}

        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-3 rounded border ${isDarkMode ? 'bg-gray-750 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Most Common
            </p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {typeMetrics.length > 0 ? typeMetrics[0].type.charAt(0).toUpperCase() + typeMetrics[0].type.slice(1) : 'N/A'}
            </p>
          </div>
          <div className={`p-3 rounded border ${isDarkMode ? 'bg-gray-750 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Total Detected
            </p>
            <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {totalMovements}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
