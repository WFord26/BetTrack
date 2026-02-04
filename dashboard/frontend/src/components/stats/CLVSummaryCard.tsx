/**
 * CLV Summary Card - Dashboard widget displaying key CLV metrics
 * Closing Line Value (CLV) is the #1 indicator of long-term betting profitability
 */
import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../store';
import { fetchCLVSummary, selectCLVSummary, selectCLVLoading, selectCLVError } from '../../store/clvSlice';
import { formatPercentage } from '../../utils/format';

export default function CLVSummaryCard() {
  const dispatch = useDispatch<AppDispatch>();
  const summary = useSelector(selectCLVSummary);
  const loading = useSelector(selectCLVLoading);
  const error = useSelector(selectCLVError);

  useEffect(() => {
    dispatch(fetchCLVSummary());
  }, [dispatch]);

  if (loading && !summary) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">Failed to load CLV data</span>
        </div>
      </div>
    );
  }

  if (!summary || summary.totalBets === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Closing Line Value
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No bet data available. Place bets with closing odds to see CLV analytics.
        </p>
      </div>
    );
  }

  // Calculate CLV category percentages
  const totalBets = summary.totalBets;
  const positivePercent = (summary.positiveCLVCount / totalBets) * 100;
  const negativePercent = (summary.negativeCLVCount / totalBets) * 100;
  const neutralPercent = (summary.neutralCLVCount / totalBets) * 100;

  // Determine overall CLV color
  const clvColor = summary.averageCLV >= 2 
    ? 'text-green-600 dark:text-green-400' 
    : summary.averageCLV <= -2 
    ? 'text-red-600 dark:text-red-400' 
    : 'text-yellow-600 dark:text-yellow-400';

  const clvBgColor = summary.averageCLV >= 2 
    ? 'from-green-500 to-green-600' 
    : summary.averageCLV <= -2 
    ? 'from-red-500 to-red-600' 
    : 'from-yellow-500 to-yellow-600';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header with gradient */}
      <div className={`bg-gradient-to-r ${clvBgColor} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white text-lg font-semibold">Closing Line Value</h3>
            <p className="text-white/80 text-sm">Avg CLV across {totalBets} bets</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {summary.averageCLV > 0 ? '+' : ''}{summary.averageCLV.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-6 space-y-4">
        {/* CLV Distribution */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">CLV Distribution</span>
            <span className="text-gray-500 dark:text-gray-500 text-xs">{totalBets} total</span>
          </div>
          
          {/* Progress bars */}
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-green-600 dark:text-green-400 font-medium">Positive CLV</span>
                <span className="text-gray-600 dark:text-gray-400">{summary.positiveCLVCount} ({positivePercent.toFixed(0)}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${positivePercent}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-yellow-600 dark:text-yellow-400 font-medium">Neutral CLV</span>
                <span className="text-gray-600 dark:text-gray-400">{summary.neutralCLVCount} ({neutralPercent.toFixed(0)}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${neutralPercent}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-red-600 dark:text-red-400 font-medium">Negative CLV</span>
                <span className="text-gray-600 dark:text-gray-400">{summary.negativeCLVCount} ({negativePercent.toFixed(0)}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${negativePercent}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">CLV Win Rate</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatPercentage(summary.clvWinRate)}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Expected ROI</p>
            <p className={`text-lg font-bold ${summary.expectedROI >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {summary.expectedROI > 0 ? '+' : ''}{summary.expectedROI.toFixed(2)}%
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Actual ROI</p>
            <p className={`text-lg font-bold ${summary.actualROI >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {summary.actualROI > 0 ? '+' : ''}{summary.actualROI.toFixed(2)}%
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">ROI Delta</p>
            <p className={`text-lg font-bold ${(summary.actualROI - summary.expectedROI) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {(summary.actualROI - summary.expectedROI) > 0 ? '+' : ''}{(summary.actualROI - summary.expectedROI).toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Info tooltip */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p>
              <strong>CLV</strong> measures how your betting odds compare to closing market lines. 
              Positive CLV indicates value betting and correlates with long-term profitability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
