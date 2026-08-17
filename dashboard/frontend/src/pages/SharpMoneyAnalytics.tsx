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
  if (score >= 8) return isDark ? 'bg-[#1a3a1a] text-[#6cbf67] border border-[#4f8f3f]' : 'bg-[#e8f5e8] text-[#4f8f3f] border border-[#4f8f3f]';
  if (score >= 6) return isDark ? 'bg-[#3a2810] text-gold border border-gold-edge' : 'bg-[#fdf3dd] text-[#8a6800] border border-[#b8860b]';
  return isDark ? 'bg-coral-chip text-coral border border-coral' : 'bg-[#fceaea] text-[#c0392b] border border-[#c0392b]';
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

  const cardCls = isDarkMode ? 'ds-panel p-4' : 'ds-card-ink p-4';

  return (
    <div className={cardCls}>
      {game && (
        <div className="mb-2">
          <p className={`font-body font-semibold text-sm ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
            {awayTeam} @ {homeTeam}
          </p>
          <p className={`font-body text-xs ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
            {game.sport?.name} · {new Date(game.commenceTime).toLocaleString()}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className={`font-display text-[6.5px] tracking-[.06em] px-2 py-1 ${isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 text-ink-secondary border border-ink'}`}>
          {marketLabel(indicator.marketType)}
        </span>
        <span className={`font-display text-[6.5px] tracking-[.06em] px-2 py-1 ${confidenceBadge(indicator.sharpConfidence, isDarkMode)}`}>
          {indicator.sharpConfidence}/10 CONF
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className={isDarkMode ? 'bg-dusk-panel2 p-2' : 'bg-sand-panel2 border border-ink p-2'}>
          <p className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-gold' : 'text-terra'}`}>
            SHARP $
          </p>
          <p className={`font-body text-sm font-semibold mt-1 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
            {sideLabel(indicator.sharpSide, homeTeam, awayTeam)}
          </p>
        </div>
        <div className={isDarkMode ? 'bg-dusk-panel2 p-2' : 'bg-sand-panel2 border border-ink p-2'}>
          <p className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
            PUBLIC
          </p>
          <p className={`font-body text-sm font-semibold mt-1 ${isDarkMode ? 'text-cream-secondary' : 'text-ink-secondary'}`}>
            {sideLabel(indicator.publicSide, homeTeam, awayTeam)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-base">{movementIcon(indicator.lineMovement)}</span>
        <span className={`font-body text-xs ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
          {indicator.lineMovement === 'no_movement' ? 'No line movement' : `${indicator.lineMovement.charAt(0).toUpperCase() + indicator.lineMovement.slice(1)} move`}
        </span>
      </div>

      {indicator.contraindicators.length > 0 && (
        <div className="mt-2">
          <p className={`font-body text-xs ${isDarkMode ? 'text-gold' : 'text-terra'}`}>
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
  const cardCls = isDarkMode ? 'ds-panel p-4' : 'ds-card-ink p-4';

  return (
    <div className={cardCls}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className={`font-body font-semibold text-sm ${isDarkMode ? 'text-cream' : 'text-ink'}`}>
            {opportunity.awayTeamName} @ {opportunity.homeTeamName}
          </p>
          <p className={`font-body text-xs ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
            {opportunity.sportKey} · {new Date(opportunity.commenceTime).toLocaleString()}
          </p>
        </div>
        <span className={`font-display text-[6.5px] tracking-[.06em] px-2 py-1 ${confidenceBadge(opportunity.maxConfidence, isDarkMode)}`}>
          {opportunity.maxConfidence}/10
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {opportunity.indicators.map((ind, i) => (
          <div
            key={i}
            className={`flex items-center justify-between font-display text-[6.5px] tracking-[.05em] px-2 py-1.5 ${isDarkMode ? 'bg-dusk-panel2 text-cream-muted' : 'bg-sand-panel2 border border-sand-divider text-ink-muted'}`}
          >
            <span>{marketLabel(ind.marketType)}</span>
            <span className={isDarkMode ? 'text-gold' : 'text-terra'}>
              SHARP → {sideLabel(ind.sharpSide, opportunity.homeTeamName, opportunity.awayTeamName)}
            </span>
            <span>{movementIcon(ind.lineMovement)}</span>
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

  const pageCls = isDarkMode ? 'min-h-screen bg-dusk' : 'min-h-screen ds-sand-bg';
  const statChipCls = isDarkMode ? 'ds-panel p-3' : 'ds-card-ink p-3';
  const tabActiveCls = isDarkMode
    ? 'bg-gold text-dusk shadow-[0_3px_0_#8a5a10]'
    : 'bg-terra text-terra-text border-2 border-ink shadow-[0_3px_0_#3a2413]';
  const tabInactiveCls = isDarkMode
    ? 'bg-dusk-panel2 text-cream-muted'
    : 'bg-sand-panel text-ink-secondary border-2 border-ink';

  return (
    <div className={pageCls}>
      {/* Header */}
      <div className={isDarkMode ? 'bg-dusk-chrome' : 'bg-terra shadow-[0_4px_0_#3a2413]'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-4">
            <p className={`font-display text-[8px] tracking-[.1em] mb-2 ${isDarkMode ? 'text-ember' : 'text-terra-text opacity-80'}`}>
              FADE THE POSSE
            </p>
            <h1
              className={`font-display text-[19px] ${isDarkMode ? 'text-cream' : 'text-terra-text'}`}
              style={{ textShadow: isDarkMode ? '4px 4px 0 #c14d21' : '3px 3px 0 #3a2413' }}
            >
              SHARP VS PUBLIC
            </h1>
            <p className={`font-body mt-2 text-sm ${isDarkMode ? 'text-cream-muted' : 'text-terra-muted'}`}>
              Track professional bettor action and fade the public
            </p>
          </div>

          {/* Stats summary */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: 'INDICATORS', value: stats.totalIndicators },
                { label: 'AVG CONF', value: `${stats.avgConfidence}/10` },
                { label: 'STEAM MOVES', value: stats.byLineMovement['steam'] || 0 },
                { label: 'REVERSE LINES', value: stats.byLineMovement['reverse'] || 0 },
              ].map(stat => (
                <div key={stat.label} className={statChipCls}>
                  <p className={`font-display text-[6px] tracking-[.1em] mb-1.5 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>{stat.label}</p>
                  <p className={`font-display text-[16px] ${isDarkMode ? 'text-gold' : 'text-ink'}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs + filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveTab('live')}
              className={`font-display text-[7px] tracking-[.06em] px-4 py-2.5 transition-all ${activeTab === 'live' ? tabActiveCls : tabInactiveCls}`}
            >
              LIVE INDICATORS
            </button>
            <button
              onClick={() => setActiveTab('contrarian')}
              className={`font-display text-[7px] tracking-[.06em] px-4 py-2.5 transition-all ${activeTab === 'contrarian' ? tabActiveCls : tabInactiveCls}`}
            >
              CONTRARIAN PICKS
            </button>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {activeTab === 'contrarian' && (
              <div className="flex items-center gap-2">
                <label htmlFor="sharp-min-confidence" className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>MIN CONF:</label>
                <select
                  id="sharp-min-confidence"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                  className={`font-display text-[7px] px-2 py-1.5 focus:outline-none ${isDarkMode ? 'bg-dusk-panel2 text-cream border-0' : 'bg-sand-panel2 text-ink border-2 border-ink'}`}
                >
                  {[4, 5, 6, 7, 8].map(v => (
                    <option key={v} value={v}>{v}/10</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label htmlFor="sharp-limit" className={`font-display text-[6px] tracking-[.08em] ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>SHOW:</label>
              <select
                id="sharp-limit"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className={`font-display text-[7px] px-2 py-1.5 focus:outline-none ${isDarkMode ? 'bg-dusk-panel2 text-cream border-0' : 'bg-sand-panel2 text-ink border-2 border-ink'}`}
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
          <div className={`p-4 mb-4 ${isDarkMode ? 'bg-coral-chip text-coral border border-coral' : 'bg-[#fceaea] text-[#c0392b] border-2 border-[#c0392b]'}`}>
            <p className="font-body text-sm">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-10 w-10 border-4 border-gold border-t-transparent" />
          </div>
        )}

        {/* Live indicators grid */}
        {!loading && activeTab === 'live' && (
          <>
            {liveIndicators.length === 0 ? (
              <div className={`text-center py-16 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                <p className="text-4xl mb-3">🦈</p>
                <p className={`font-display text-[11px] mb-2 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>NO SHARP ACTIVITY</p>
                <p className="font-body text-sm">Sharp indicators are calculated every 15 minutes from line movement data.</p>
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
            <div className={`p-3 mb-4 ${isDarkMode ? 'bg-dusk-panel2 border border-dusk-ring' : 'bg-sand-panel2 border-2 border-ink'}`}>
              <p className={`font-body text-sm ${isDarkMode ? 'text-cream-secondary' : 'text-ink-secondary'}`}>
                <strong className={isDarkMode ? 'text-gold' : 'text-terra'}>💡 Fade the Public:</strong> These games show sharp money on the less-popular side. Historically, fading heavy public sides can be profitable.
              </p>
            </div>
            {contrarianOpportunities.length === 0 ? (
              <div className={`text-center py-16 ${isDarkMode ? 'text-cream-muted' : 'text-ink-muted'}`}>
                <p className="text-4xl mb-3">↩️</p>
                <p className={`font-display text-[11px] mb-2 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>NO CONTRARIAN OPPORTUNITIES</p>
                <p className="font-body text-sm">Try lowering the minimum confidence threshold.</p>
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
        <div className={`mt-8 p-5 ${isDarkMode ? 'ds-panel' : 'ds-card-ink'}`}>
          <p className={`font-display text-[8px] tracking-[.08em] mb-3 ${isDarkMode ? 'text-cream' : 'text-ink'}`}>READING THE SIGNS</p>
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
