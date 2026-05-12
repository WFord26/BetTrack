/**
 * Line Movement Analytics Page
 * Main analytics dashboard for viewing and analyzing line movements
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { MovementType } from '../types/movements.types';
import {
  fetchLiveMovements,
  setFilters,
  selectLiveMovements,
  selectMovementLoading,
  selectMovementError
} from '../store/movementSlice';
import SteamMoveAlert from '../components/analytics/SteamMoveAlert';
import LineMovementChart from '../components/analytics/LineMovementChart';
import LineMovementPerformance from '../components/analytics/LineMovementPerformance';
import { useDarkMode } from '../contexts/DarkModeContext';
import { LineMovement } from '../types/movements.types';

export default function LineMovementAnalytics() {
  const dispatch = useDispatch<AppDispatch>();
  const { isDarkMode } = useDarkMode();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const movements = useSelector(selectLiveMovements);
  const loading = useSelector(selectMovementLoading);
  const error = useSelector(selectMovementError);
  
  const [movementType, setMovementType] = useState(searchParams.get('type') || 'all');
  const [hoursBack, setHoursBack] = useState(parseInt(searchParams.get('hours') || '24', 10));
  const [marketType, setMarketType] = useState(searchParams.get('market') || 'all');

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (movementType !== 'all') params.set('type', movementType);
    if (hoursBack !== 24) params.set('hours', hoursBack.toString());
    if (marketType !== 'all') params.set('market', marketType);
    setSearchParams(params);
  }, [movementType, hoursBack, marketType, setSearchParams]);

  // Fetch movements when filters change
  useEffect(() => {
    dispatch(fetchLiveMovements({
      limit: 100,
      hoursBack,
      movementType: movementType as MovementType | 'all'
    }));
  }, [dispatch, movementType, hoursBack]);

  // Filter movements by market type if needed
  const filteredMovements = marketType === 'all'
    ? movements
    : movements.filter(m => m.marketType === marketType);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <div className={`border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">📈</span>
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Line Movement Analytics
              </h1>
              <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Track and analyze sharp action across bookmakers
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
            {/* Movement Type Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Movement Type
              </label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className={`w-full px-3 py-2 rounded border ${
                  isDarkMode
                    ? 'bg-gray-750 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All Types</option>
                <option value="steam">🔥 Steam Moves</option>
                <option value="reverse">⬅️ Reverse Moves</option>
                <option value="gradual">📊 Gradual Moves</option>
                <option value="injury">🏥 Injury News</option>
              </select>
            </div>

            {/* Market Type Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Market Type
              </label>
              <select
                value={marketType}
                onChange={(e) => setMarketType(e.target.value)}
                className={`w-full px-3 py-2 rounded border ${
                  isDarkMode
                    ? 'bg-gray-750 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value="all">All Markets</option>
                <option value="h2h">Moneyline (H2H)</option>
                <option value="spreads">Point Spreads</option>
                <option value="totals">Over/Unders</option>
              </select>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Time Range
              </label>
              <select
                value={hoursBack}
                onChange={(e) => setHoursBack(parseInt(e.target.value, 10))}
                className={`w-full px-3 py-2 rounded border ${
                  isDarkMode
                    ? 'bg-gray-750 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                <option value={4}>Last 4 hours</option>
                <option value={24}>Last 24 hours</option>
                <option value={168}>Last 7 days</option>
                <option value={720}>Last 30 days</option>
              </select>
            </div>

            {/* Results Count */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Results
              </label>
              <div className={`px-3 py-2 rounded border ${
                isDarkMode
                  ? 'bg-gray-750 border-gray-600'
                  : 'bg-gray-50 border-gray-300'
              }`}>
                <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {filteredMovements.length} movements
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className={`mb-6 p-4 rounded border-l-4 ${isDarkMode ? 'bg-red-900/20 border-red-600 text-red-200' : 'bg-red-100 border-red-400 text-red-800'}`}>
            <p className="font-medium">Error loading movements</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Content - Left (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Steam Move Alert Widget */}
            <SteamMoveAlert limit={20} refreshInterval={60000} />

            {/* Movement Timeline */}
            <LineMovementChart
              movements={filteredMovements}
              marketType={marketType === 'all' ? undefined : (marketType as any)}
              title={`${movementType === 'all' ? 'All' : movementType.charAt(0).toUpperCase() + movementType.slice(1)} Movements Timeline`}
            />
          </div>

          {/* Sidebar - Right (1 column) */}
          <div className="space-y-6">
            {/* Performance Stats */}
            <LineMovementPerformance
              hoursBack={hoursBack}
              showChart={true}
              compact={false}
            />

            {/* Quick Stats */}
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-4`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Quick Tips
              </h3>
              <ul className={`text-sm space-y-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                <li>🔥 <strong>Steam</strong> = Sharp/coordinated action</li>
                <li>⬅️ <strong>Reverse</strong> = Line vs public sentiment</li>
                <li>📊 <strong>Gradual</strong> = Slow information drift</li>
                <li>🏥 <strong>Injury</strong> = News-driven moves</li>
              </ul>
            </div>

            {/* Legend */}
            <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg border p-4`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Severity Levels
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-600"></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <strong>Critical:</strong> 5+ books, 2.5+ pts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <strong>High:</strong> 4+ books, 2+ pts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-600"></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <strong>Medium:</strong> 3+ books, 1.5+ pts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
