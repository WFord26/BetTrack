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

  const pageCls = isDarkMode ? 'min-h-screen bg-dusk' : 'min-h-screen ds-sand-bg';
  const selectCls = `w-full font-display text-[7px] tracking-[.06em] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold ${
    isDarkMode ? 'bg-dusk-panel2 text-cream border-0' : 'bg-sand-panel2 text-ink border-2 border-ink'
  }`;

  return (
    <div className={pageCls}>
      {/* Header */}
      <div className={isDarkMode ? 'bg-dusk-chrome' : 'bg-terra shadow-[0_4px_0_#3a2413]'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <p className={`font-display text-[8px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-ember' : 'text-terra-text opacity-80'}`}>
              THE WIRE
            </p>
            <h1
              className={`font-display text-[19px] ${isDarkMode ? 'text-cream' : 'text-terra-text'}`}
              style={{ textShadow: isDarkMode ? '4px 4px 0 #c14d21' : '3px 3px 0 #3a2413' }}
            >
              LINE MOVEMENT
            </h1>
            <p className={`font-body mt-2 text-sm ${isDarkMode ? 'text-cream-muted' : 'text-terra-muted'}`}>
              Track and analyze sharp action across bookmakers
            </p>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
            <div>
              <label className={`block font-display text-[6px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-cream-muted' : 'text-terra-muted'}`}>
                MOVEMENT TYPE
              </label>
              <select value={movementType} onChange={(e) => setMovementType(e.target.value)} className={selectCls}>
                <option value="all">All Types</option>
                <option value="steam">Steam Moves</option>
                <option value="reverse">Reverse Moves</option>
                <option value="gradual">Gradual Moves</option>
                <option value="injury">Injury News</option>
              </select>
            </div>

            <div>
              <label className={`block font-display text-[6px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-cream-muted' : 'text-terra-muted'}`}>
                MARKET TYPE
              </label>
              <select value={marketType} onChange={(e) => setMarketType(e.target.value)} className={selectCls}>
                <option value="all">All Markets</option>
                <option value="h2h">Moneyline</option>
                <option value="spreads">Point Spreads</option>
                <option value="totals">Over/Unders</option>
              </select>
            </div>

            <div>
              <label className={`block font-display text-[6px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-cream-muted' : 'text-terra-muted'}`}>
                TIME RANGE
              </label>
              <select value={hoursBack} onChange={(e) => setHoursBack(parseInt(e.target.value, 10))} className={selectCls}>
                <option value={4}>Last 4 hours</option>
                <option value={24}>Last 24 hours</option>
                <option value={168}>Last 7 days</option>
                <option value={720}>Last 30 days</option>
              </select>
            </div>

            <div>
              <label className={`block font-display text-[6px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-cream-muted' : 'text-terra-muted'}`}>
                RESULTS
              </label>
              <div className={`px-3 py-2.5 ${isDarkMode ? 'bg-dusk-panel2' : 'bg-sand-panel2 border-2 border-ink'}`}>
                <span className={`font-display text-[7px] ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
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
          <div className={`mb-6 p-4 border-l-4 ${isDarkMode ? 'bg-coral-chip border-coral text-coral' : 'bg-[#fceaea] border-[#c0392b] text-[#c0392b]'}`}>
            <p className="font-display text-[8px] tracking-[.06em] mb-1">ERROR LOADING MOVEMENTS</p>
            <p className="font-body text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <SteamMoveAlert limit={20} refreshInterval={60000} />
            <LineMovementChart
              movements={filteredMovements}
              marketType={marketType === 'all' ? undefined : (marketType as any)}
              title={`${movementType === 'all' ? 'All' : movementType.charAt(0).toUpperCase() + movementType.slice(1)} Movements Timeline`}
            />
          </div>

          <div className="space-y-6">
            <LineMovementPerformance hoursBack={hoursBack} showChart={true} compact={false} />

            <div className={isDarkMode ? 'ds-panel p-4' : 'ds-card-ink p-4'}>
              <h3 className={`font-display text-[8px] tracking-[.08em] mb-3 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
                QUICK TIPS
              </h3>
              <ul className={`font-body text-sm space-y-2 ${isDarkMode ? 'text-cream-secondary' : 'text-ink-secondary'}`}>
                <li>🔥 <strong>Steam</strong> = Sharp/coordinated action</li>
                <li>⬅️ <strong>Reverse</strong> = Line vs public sentiment</li>
                <li>📊 <strong>Gradual</strong> = Slow information drift</li>
                <li>🏥 <strong>Injury</strong> = News-driven moves</li>
              </ul>
            </div>

            <div className={isDarkMode ? 'ds-panel p-4' : 'ds-card-ink p-4'}>
              <h3 className={`font-display text-[8px] tracking-[.08em] mb-3 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
                SEVERITY LEVELS
              </h3>
              <div className="space-y-2">
                {[
                  { color: '#ef5350', label: 'Critical', desc: '5+ books, 2.5+ pts' },
                  { color: '#f97b2c', label: 'High', desc: '4+ books, 2+ pts' },
                  { color: '#fcc63a', label: 'Medium', desc: '3+ books, 1.5+ pts' },
                ].map(({ color, label, desc }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-3 h-3 flex-shrink-0" style={{ background: color }} />
                    <span className={`font-body text-sm ${isDarkMode ? 'text-cream-secondary' : 'text-ink-secondary'}`}>
                      <strong className={isDarkMode ? 'text-cream' : 'text-ink'}>{label}:</strong> {desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
