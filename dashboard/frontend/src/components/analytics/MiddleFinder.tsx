/**
 * Middle Finder
 *
 * Lists middle opportunities: two lines with a gap where both legs can win.
 * Shows the winning window, the modelled probability of landing in it, and
 * the expected value of the position.
 */

import React from 'react';
import { ArbitrageOpportunity } from '../../types/arbitrage.types';
import { formatCurrency, formatRelativeTime } from '../../utils/format';
import SnapshotAgeBadge from './SnapshotAgeBadge';

interface Props {
  opportunities: ArbitrageOpportunity[];
  isDarkMode: boolean;
  loading?: boolean;
}

function gapLabel(opportunity: ArbitrageOpportunity): string {
  const low = Number(opportunity.middleGapLow);
  const high = Number(opportunity.middleGapHigh);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return 'Unknown window';

  if (opportunity.marketType === 'totals') {
    return `Total lands between ${low} and ${high}`;
  }
  const home = opportunity.game?.homeTeamName ?? 'Home';
  return `${home} wins by more than ${low} but less than ${high}`;
}

export default function MiddleFinder({ opportunities, isDarkMode, loading }: Props) {
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  const middles = opportunities.filter((o) => o.arbType === 'middle');

  if (loading) {
    return (
      <div className={`rounded-lg border p-6 text-center ${cardBg}`}>
        <p className={textSecondary}>Loading middles...</p>
      </div>
    );
  }

  if (middles.length === 0) {
    return (
      <div className={`rounded-lg border p-6 text-center ${cardBg}`}>
        <p className={`text-sm ${textSecondary}`}>
          No middle opportunities in the current odds snapshot.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {middles.map((opportunity) => {
        const probability = Number(opportunity.middleProbability ?? 0);

        return (
          <div key={opportunity.id} className={`rounded-lg border p-4 ${cardBg}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className={`font-semibold text-sm ${textPrimary}`}>
                  {opportunity.game
                    ? `${opportunity.game.awayTeamName} @ ${opportunity.game.homeTeamName}`
                    : 'Game unavailable'}
                </p>
                <p className={`text-xs ${textSecondary}`}>
                  {opportunity.game?.sport?.name} ·{' '}
                  {opportunity.marketType === 'totals' ? 'Total' : 'Spread'} · detected{' '}
                  {formatRelativeTime(opportunity.detectedAt)}
                </p>
              </div>
              <SnapshotAgeBadge ageSeconds={opportunity.oddsSnapshotAge} isDarkMode={isDarkMode} />
            </div>

            <div
              className={`rounded p-2 mb-3 text-xs ${
                isDarkMode ? 'bg-purple-900/30 text-purple-200' : 'bg-purple-50 text-purple-800'
              }`}
            >
              <span className="font-medium">Both legs win if: </span>
              {gapLabel(opportunity)}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {opportunity.legs.map((leg, index) => (
                <div
                  key={index}
                  className={`rounded p-2 ${isDarkMode ? 'bg-gray-700/60' : 'bg-gray-50'}`}
                >
                  <p className={`text-xs font-medium ${textSecondary}`}>{leg.bookmaker}</p>
                  <p className={`text-sm font-semibold ${textPrimary}`}>{leg.label}</p>
                  <p className={`text-xs ${textSecondary}`}>
                    {leg.odds > 0 ? `+${leg.odds}` : leg.odds} · stake {formatCurrency(leg.stake)}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className={`text-xs ${textSecondary}`}>Hit chance</p>
                <p className={`text-sm font-semibold ${textPrimary}`}>
                  {(probability * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className={`text-xs ${textSecondary}`}>Expected value</p>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(Number(opportunity.expectedProfit))}
                </p>
              </div>
              <div>
                <p className={`text-xs ${textSecondary}`}>On stake</p>
                <p className={`text-sm font-semibold ${textPrimary}`}>
                  {formatCurrency(Number(opportunity.stake))}
                </p>
              </div>
            </div>

            <p className={`mt-2 text-xs ${textSecondary}`}>
              Hit chance is modelled from the gap width and typical result spread for the sport, not
              a guarantee. Outside the window one leg still wins, so the downside is the small loss
              shown by the calculator.
            </p>
          </div>
        );
      })}
    </div>
  );
}
